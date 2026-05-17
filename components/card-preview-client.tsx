"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Copy, RotateCcw, Eye, EyeOff } from "lucide-react"
import { CardCanvas, type CardCanvasSong } from "@/components/card-canvas"
import {
  CARD_SIZE,
  DEFAULT_STYLE,
  STORAGE_KEY,
  type CardStyle,
  type TextStyle,
} from "@/lib/card-style"

export type PreviewSong = CardCanvasSong & {
  id: string
  added_at?: string
}

type Element = "artist" | "year" | "title" | "cardNumber" | "qr"

export function CardPreviewClient({ songs }: { songs: PreviewSong[] }) {
  const searchParams = useSearchParams()
  const initialSongId = searchParams.get("song")

  const [style, setStyle] = useState<CardStyle>(DEFAULT_STYLE)
  const [side, setSide] = useState<"front" | "back">("front")
  const [scale, setScale] = useState(0.6)
  const [showGuides, setShowGuides] = useState(false)
  const [element, setElement] = useState<Element>("year")

  const [songIndex, setSongIndex] = useState(() => {
    if (!songs.length) return 0
    if (initialSongId) {
      const idx = songs.findIndex((s) => s.id === initialSongId)
      if (idx >= 0) return idx
    }
    return 0
  })

  // Wczytaj zapisany styl z localStorage (raz, po mount).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as CardStyle
        setStyle({ ...DEFAULT_STYLE, ...parsed })
      }
    } catch {
      /* ignore */
    }
  }, [])

  // Zapisuj zmiany.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(style))
    } catch {
      /* ignore */
    }
  }, [style])

  const currentSong = songs[songIndex]
  const cardNumber = songIndex + 1

  function patch<K extends keyof CardStyle>(
    key: K,
    next: Partial<CardStyle[K]>,
  ) {
    setStyle((prev) => ({ ...prev, [key]: { ...prev[key], ...next } }))
  }

  function resetAll() {
    setStyle(DEFAULT_STYLE)
    toast.success("Przywrócono ustawienia domyślne")
  }

  async function copyExport() {
    const snippet = buildExportSnippet(style)
    try {
      await navigator.clipboard.writeText(snippet)
      toast.success("Snippet skopiowany — wklej do generate.js")
    } catch {
      toast.error("Nie udało się skopiować")
    }
  }

  if (songs.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-muted-foreground">
          Brak piosenek w bazie — najpierw dodaj kilka, żeby było co podglądać.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-4 text-2xl font-bold">Podgląd karty</h1>

        <SegBar
          options={[
            { value: "front", label: "Front" },
            { value: "back", label: "Back" },
          ]}
          value={side}
          onChange={setSide}
        />

        <SegBar
          options={[
            { value: 0.5, label: "50%" },
            { value: 0.6, label: "60%" },
            { value: 0.75, label: "75%" },
            { value: 1, label: "100%" },
          ]}
          value={scale}
          onChange={setScale}
        />

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowGuides((g) => !g)}
        >
          {showGuides ? <EyeOff className="mr-1 size-4" /> : <Eye className="mr-1 size-4" />}
          Linie pomocnicze
        </Button>

        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={resetAll}>
            <RotateCcw className="mr-1 size-4" />
            Reset
          </Button>
          <Button size="sm" onClick={copyExport}>
            <Copy className="mr-1 size-4" />
            Eksportuj do generate.js
          </Button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="text-sm text-muted-foreground">Piosenka:</label>
        <select
          value={songIndex}
          onChange={(e) => setSongIndex(Number(e.target.value))}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          {songs.map((s, i) => (
            <option key={s.id} value={i}>
              #{String(i + 1).padStart(3, "0")} — {s.artist} — {s.title}
              {s.year ? ` (${s.year})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Canvas */}
        <Card className="overflow-auto">
          <CardContent className="flex items-center justify-center p-6">
            {currentSong && (
              <div className="relative" style={{ width: CARD_SIZE * scale, height: CARD_SIZE * scale }}>
                <CardCanvas
                  song={currentSong}
                  cardNumber={cardNumber}
                  side={side}
                  style={style}
                  scale={scale}
                  showGuides={showGuides}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Controls */}
        <div className="space-y-4">
          <SegBar
            options={[
              { value: "artist", label: "Wykonawca" },
              { value: "year", label: "Rok" },
              { value: "title", label: "Tytuł" },
              { value: "cardNumber", label: "Numer" },
              { value: "qr", label: "QR" },
            ]}
            value={element}
            onChange={setElement}
            fullWidth
          />

          <Card>
            <CardContent className="space-y-4 p-4">
              {element === "artist" && (
                <TextControls
                  style={style.artist}
                  centerY={style.artist.centerY}
                  onChange={(next) => patch("artist", next)}
                  showCenterY
                />
              )}
              {element === "year" && (
                <>
                  <TextControls
                    style={style.year}
                    centerY={style.year.centerY}
                    onChange={(next) => patch("year", next)}
                    showCenterY
                  />
                  <NumberRow
                    label="Max width"
                    value={style.year.maxWidth}
                    min={100}
                    max={CARD_SIZE}
                    onChange={(v) => patch("year", { maxWidth: v })}
                  />
                  <NumberRow
                    label="Max height"
                    value={style.year.maxHeight}
                    min={40}
                    max={CARD_SIZE}
                    onChange={(v) => patch("year", { maxHeight: v })}
                  />
                </>
              )}
              {element === "title" && (
                <TextControls
                  style={style.title}
                  centerY={style.title.centerY}
                  onChange={(next) => patch("title", next)}
                  showCenterY
                />
              )}
              {element === "cardNumber" && (
                <>
                  <TextControls
                    style={style.cardNumber}
                    onChange={(next) => patch("cardNumber", next)}
                  />
                  <NumberRow
                    label="Right padding"
                    value={style.cardNumber.rightPadding}
                    min={0}
                    max={120}
                    onChange={(v) => patch("cardNumber", { rightPadding: v })}
                  />
                  <NumberRow
                    label="Bottom padding"
                    value={style.cardNumber.bottomPadding}
                    min={0}
                    max={120}
                    onChange={(v) => patch("cardNumber", { bottomPadding: v })}
                  />
                </>
              )}
              {element === "qr" && (
                <>
                  <NumberRow
                    label="Center X"
                    value={style.qr.centerX}
                    min={0}
                    max={CARD_SIZE}
                    onChange={(v) => patch("qr", { centerX: v })}
                  />
                  <NumberRow
                    label="Center Y"
                    value={style.qr.centerY}
                    min={0}
                    max={CARD_SIZE}
                    onChange={(v) => patch("qr", { centerY: v })}
                  />
                  <NumberRow
                    label="Size"
                    value={style.qr.size}
                    min={100}
                    max={600}
                    onChange={(v) => patch("qr", { size: v })}
                  />
                </>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Wszystkie zmiany zapisują się automatycznie w przeglądarce
            (localStorage). „Eksportuj do generate.js" kopiuje gotowy
            snippet do schowka — wklej go do <code>generate.js</code>
            i odpal <code>bun run generate.js</code>.
          </p>
        </div>
      </div>
    </main>
  )
}

// =====================================================================
// Pod-komponenty
// =====================================================================

function TextControls<T extends TextStyle & { centerY?: number }>({
  style,
  centerY,
  onChange,
  showCenterY = false,
}: {
  style: T
  centerY?: number
  onChange: (next: Partial<T>) => void
  showCenterY?: boolean
}) {
  return (
    <>
      <SelectRow
        label="Font"
        value={style.family}
        options={["Inter", "Playfair Display"]}
        onChange={(v) =>
          onChange({ family: v as TextStyle["family"] } as Partial<T>)
        }
      />
      <NumberRow
        label="Weight"
        value={style.weight}
        min={100}
        max={900}
        step={100}
        onChange={(v) => onChange({ weight: v } as Partial<T>)}
      />
      <NumberRow
        label="Size (px)"
        value={style.sizePx}
        min={6}
        max={300}
        onChange={(v) => onChange({ sizePx: v } as Partial<T>)}
      />
      <NumberRow
        label="Letter spacing"
        value={style.letterSpacingPx}
        min={-5}
        max={30}
        step={0.5}
        onChange={(v) => onChange({ letterSpacingPx: v } as Partial<T>)}
      />
      <ColorRow
        label="Kolor"
        value={style.color}
        onChange={(v) => onChange({ color: v } as Partial<T>)}
      />
      {showCenterY && typeof centerY === "number" && (
        <NumberRow
          label="Center Y"
          value={centerY}
          min={0}
          max={CARD_SIZE}
          onChange={(v) => onChange({ centerY: v } as Partial<T>)}
        />
      )}
    </>
  )
}

function NumberRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <Input
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-7 w-20 text-right text-xs"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  )
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-10 cursor-pointer rounded border border-input bg-transparent"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-24 font-mono text-xs"
        />
      </div>
    </div>
  )
}

function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

function SegBar<T extends string | number>({
  options,
  value,
  onChange,
  fullWidth = false,
}: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  fullWidth?: boolean
}) {
  return (
    <div
      className={`inline-flex rounded-md border border-input p-0.5 ${fullWidth ? "w-full" : ""}`}
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`${fullWidth ? "flex-1" : ""} rounded px-2.5 py-1 text-xs transition-colors ${
            o.value === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// =====================================================================
// Export snippetu do generate.js
// =====================================================================

function buildExportSnippet(s: CardStyle): string {
  const j = (v: unknown) => JSON.stringify(v)
  return `// ↓ Wklej w generate.js zastępując obecny obiekt STYLE oraz stałe
// FRONT_ARTIST_Y / FRONT_YEAR_Y / FRONT_TITLE_Y / QR_CENTER_X / QR_CENTER_Y / QR_SIZE.

const STYLE = {
  artist: {
    family: ${j(s.artist.family)},
    weight: ${s.artist.weight},
    sizePx: ${s.artist.sizePx},
    color: ${j(s.artist.color)},
    letterSpacingPx: ${s.artist.letterSpacingPx},
  },
  year: {
    family: ${j(s.year.family)},
    weight: ${s.year.weight},
    sizePx: ${s.year.sizePx},
    color: ${j(s.year.color)},
    letterSpacingPx: ${s.year.letterSpacingPx},
    maxWidth: ${s.year.maxWidth},
    maxHeight: ${s.year.maxHeight},
  },
  title: {
    family: ${j(s.title.family)},
    weight: ${s.title.weight},
    sizePx: ${s.title.sizePx},
    color: ${j(s.title.color)},
    letterSpacingPx: ${s.title.letterSpacingPx},
  },
  cardNumber: {
    family: ${j(s.cardNumber.family)},
    weight: ${s.cardNumber.weight},
    sizePx: ${s.cardNumber.sizePx},
    color: ${j(s.cardNumber.color)},
    letterSpacingPx: ${s.cardNumber.letterSpacingPx},
  },
};

const FRONT_CENTER_X = 419;
const FRONT_ARTIST_Y = ${s.artist.centerY};
const FRONT_YEAR_Y   = ${s.year.centerY};
const FRONT_TITLE_Y  = ${s.title.centerY};

const QR_CENTER_X = ${s.qr.centerX};
const QR_CENTER_Y = ${s.qr.centerY};
const QR_SIZE     = ${s.qr.size};

// Numer karty pozycjonowany przez paddingi (right/bottom):
//   right: ${s.cardNumber.rightPadding}
//   bottom: ${s.cardNumber.bottomPadding}
`
}
