/**
 * PDF generator — server-only. Port logiki z generate.js do reużycia z API route.
 * Render tekstu przez sharp+Pango (zostawiamy bo działa lokalnie i daje pełną
 * kontrolę nad letter-spacingiem i wagą fontu z plików variable).
 */
import sharp from "sharp"
import QRCode from "qrcode"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import type { CardStyle, TextStyle } from "@/lib/card-style"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit") as typeof import("pdfkit")

const CARD_PX = 838
const PX_TO_PT = 72 / 300
const CARD_PT = CARD_PX * PX_TO_PT

const FONTS = {
  inter: {
    file: "Inter-Variable.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf",
  },
  playfair: {
    file: "PlayfairDisplay-Variable.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf",
  },
} as const

const FONTS_DIR = path.join(process.cwd(), "fonts")

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export async function ensureFonts(): Promise<{ inter: string; playfair: string }> {
  ensureDir(FONTS_DIR)
  for (const [, { file, url }] of Object.entries(FONTS)) {
    const filePath = path.join(FONTS_DIR, file)
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 1000) {
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(
          `Nie udało się pobrać fontu ${file} z ${url} (HTTP ${res.status})`
        )
      }
      const buf = Buffer.from(await res.arrayBuffer())
      fs.writeFileSync(filePath, buf)
    }
  }
  // sharp+Pango (libvips bundled w sharpie) na macOS szuka fontów w
  // ~/Library/Fonts. Skopiuj tam, jeśli brak.
  if (process.platform === "darwin") {
    const userFontsDir = path.join(os.homedir(), "Library", "Fonts")
    if (fs.existsSync(userFontsDir)) {
      for (const { file } of Object.values(FONTS)) {
        const src = path.join(FONTS_DIR, file)
        const dst = path.join(userFontsDir, file)
        try {
          if (
            fs.existsSync(dst) &&
            fs.statSync(dst).size === fs.statSync(src).size
          ) {
            continue
          }
          fs.copyFileSync(src, dst)
        } catch {
          /* ignore */
        }
      }
    }
  }
  return {
    inter: path.join(FONTS_DIR, FONTS.inter.file),
    playfair: path.join(FONTS_DIR, FONTS.playfair.file),
  }
}

function escPango(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

type RenderedText = { buf: Buffer; width: number; height: number } | null

async function renderText(
  text: string,
  style: TextStyle,
  fontFile: string,
  opts: { width?: number } = {}
): Promise<RenderedText> {
  const safe = String(text ?? "").trim()
  if (!safe) return null

  const ls = Math.round(style.letterSpacingPx * 1024)
  const attrs = [`weight="${style.weight}"`, `foreground="${style.color}"`]
  if (ls > 0) attrs.push(`letter_spacing="${ls}"`)
  const markup = `<span ${attrs.join(" ")}>${escPango(safe)}</span>`

  const textOpts: {
    text: string
    font: string
    fontfile: string
    rgba: boolean
    dpi: number
    width?: number
  } = {
    text: markup,
    font: `${style.family} ${style.sizePx}`,
    fontfile: fontFile,
    rgba: true,
    dpi: 72,
  }
  if (opts.width) textOpts.width = opts.width

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const img = sharp({ text: textOpts as any })
  const buf = await img.png().toBuffer()
  const meta = await sharp(buf).metadata()
  return { buf, width: meta.width ?? 0, height: meta.height ?? 0 }
}

async function renderTextFit(
  text: string,
  style: TextStyle,
  fontFile: string,
  maxWidth: number,
  minSize = 14
): Promise<RenderedText> {
  let size = style.sizePx
  let result: RenderedText = null
  while (size >= minSize) {
    result = await renderText(text, { ...style, sizePx: size }, fontFile)
    if (!result) return null
    if (result.width <= maxWidth) break
    size -= 2
  }
  const hardLimit = Math.min(maxWidth, CARD_PX)
  if (result && result.width > hardLimit) {
    const resized = await sharp(result.buf)
      .resize(hardLimit, null, { fit: "inside", kernel: "lanczos3" })
      .png()
      .toBuffer()
    const meta = await sharp(resized).metadata()
    result = { buf: resized, width: meta.width ?? 0, height: meta.height ?? 0 }
  }
  return result
}

const FRONT_CENTER_X = 419

export type CardSong = {
  artist?: string | null
  title?: string | null
  year?: number | null
  spotify_track_id?: string | null
}

async function makeFront(
  templateBuf: Buffer,
  song: CardSong,
  cardNumber: number,
  fonts: { inter: string; playfair: string },
  style: CardStyle
): Promise<Buffer> {
  const cardNo = String(cardNumber).padStart(3, "0")
  const maxTextWidth = Math.round(CARD_PX * 0.86)

  const artist = (song.artist || "").toUpperCase().trim()
  const title = (song.title || "").trim()
  const year = String(song.year ?? "").trim()

  const [artistImg, yearImg, titleImg, numberImg] = await Promise.all([
    renderTextFit(artist, style.artist, fonts.inter, maxTextWidth, 12),
    renderTextFit(year, style.year, fonts.playfair, style.year.maxWidth, 80),
    renderTextFit(title, style.title, fonts.inter, maxTextWidth, 12),
    renderText(cardNo, style.cardNumber, fonts.inter),
  ])

  const composites: sharp.OverlayOptions[] = []

  function place(img: RenderedText, centerX: number, centerY: number) {
    if (!img) return
    composites.push({
      input: img.buf,
      top: Math.round(centerY - img.height / 2),
      left: Math.round(centerX - img.width / 2),
    })
  }

  place(artistImg, FRONT_CENTER_X, style.artist.centerY)
  place(yearImg, FRONT_CENTER_X, style.year.centerY)
  place(titleImg, FRONT_CENTER_X, style.title.centerY)

  if (numberImg) {
    composites.push({
      input: numberImg.buf,
      top: CARD_PX - numberImg.height - style.cardNumber.bottomPadding,
      left: CARD_PX - numberImg.width - style.cardNumber.rightPadding,
    })
  }

  return await sharp(templateBuf).composite(composites).png().toBuffer()
}

async function makeBack(
  templateBuf: Buffer,
  song: CardSong,
  style: CardStyle
): Promise<Buffer> {
  const trackId = song.spotify_track_id
  if (!trackId) {
    return await sharp(templateBuf).png().toBuffer()
  }

  const url = `https://open.spotify.com/track/${trackId}`
  const qrBuf = await QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: "H",
    margin: 1,
    width: style.qr.size,
    color: { dark: "#FFFFFFFF", light: "#00000000" },
  })

  const left = Math.round(style.qr.centerX - style.qr.size / 2)
  const top = Math.round(style.qr.centerY - style.qr.size / 2)

  return await sharp(templateBuf)
    .composite([{ input: qrBuf, top, left }])
    .png()
    .toBuffer()
}

function collectPdf(builder: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({ autoFirstPage: false })
    doc.on("data", (chunk: Buffer) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
    builder(doc)
    doc.end()
  })
}

async function buildSinglesPdf(cards: { front: Buffer; back: Buffer }[]): Promise<Buffer> {
  return collectPdf((doc) => {
    for (const { front, back } of cards) {
      doc.addPage({ size: [CARD_PT, CARD_PT], margin: 0 })
      doc.image(front, 0, 0, { width: CARD_PT, height: CARD_PT })
      doc.addPage({ size: [CARD_PT, CARD_PT], margin: 0 })
      doc.image(back, 0, 0, { width: CARD_PT, height: CARD_PT })
    }
  })
}

async function buildSheetPdf(cards: { front: Buffer; back: Buffer }[]): Promise<Buffer> {
  const A4_W_PT = 3508 * PX_TO_PT
  const A4_H_PT = 2480 * PX_TO_PT
  const COLS = 3
  const ROWS = 2
  const GAP_PT = 20 * PX_TO_PT
  const CROP_PT = 15 * PX_TO_PT
  const gridW = COLS * CARD_PT + (COLS - 1) * GAP_PT
  const gridH = ROWS * CARD_PT + (ROWS - 1) * GAP_PT
  const marginX = (A4_W_PT - gridW) / 2
  const marginY = (A4_H_PT - gridH) / 2
  const perSheet = COLS * ROWS

  return collectPdf((doc) => {
    function drawCardAt(image: Buffer, idx: number) {
      const col = idx % COLS
      const row = Math.floor(idx / COLS)
      const x = marginX + col * (CARD_PT + GAP_PT)
      const y = marginY + row * (CARD_PT + GAP_PT)

      doc.image(image, x, y, { width: CARD_PT, height: CARD_PT })

      doc.save()
      doc.lineWidth(0.5).strokeColor("#888888")
      const corners = [
        { cx: x, cy: y, dx: -1, dy: -1 },
        { cx: x + CARD_PT, cy: y, dx: 1, dy: -1 },
        { cx: x, cy: y + CARD_PT, dx: -1, dy: 1 },
        { cx: x + CARD_PT, cy: y + CARD_PT, dx: 1, dy: 1 },
      ]
      for (const { cx, cy, dx, dy } of corners) {
        doc.moveTo(cx, cy).lineTo(cx + dx * CROP_PT, cy).stroke()
        doc.moveTo(cx, cy).lineTo(cx, cy + dy * CROP_PT).stroke()
      }
      doc.restore()
    }

    function addSheet(images: Buffer[]) {
      doc.addPage({ size: [A4_W_PT, A4_H_PT], margin: 0 })
      images.forEach((img, i) => drawCardAt(img, i))
    }

    for (let i = 0; i < cards.length; i += perSheet) {
      addSheet(cards.slice(i, i + perSheet).map((c) => c.front))
    }
    for (let i = 0; i < cards.length; i += perSheet) {
      addSheet(cards.slice(i, i + perSheet).map((c) => c.back))
    }
  })
}

export type GenerateOpts = {
  songs: CardSong[]
  style: CardStyle
  templateFront: Buffer
  templateBack: Buffer
  layout: "singles" | "sheet"
}

export async function generatePdf(opts: GenerateOpts): Promise<Buffer> {
  const fonts = await ensureFonts()

  const cards: { front: Buffer; back: Buffer }[] = []
  for (let i = 0; i < opts.songs.length; i++) {
    const song = opts.songs[i]
    const n = i + 1
    const [front, back] = await Promise.all([
      makeFront(opts.templateFront, song, n, fonts, opts.style),
      makeBack(opts.templateBack, song, opts.style),
    ])
    cards.push({ front, back })
  }

  return opts.layout === "sheet" ? buildSheetPdf(cards) : buildSinglesPdf(cards)
}

export function slugifyPlaylistName(name: string): string {
  const polishMap: Record<string, string> = {
    ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
  }
  return (
    name
      .toLowerCase()
      .replace(/[ąćęłńóśźż]/g, (ch) => polishMap[ch] ?? ch)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "lista"
  )
}
