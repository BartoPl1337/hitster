// generate.js — Generator kart Hitster (PDF do druku)
// Uruchomienie: bun run generate.js

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// Bun automatycznie wczytuje .env oraz .env.local — żaden dotenv nie jest
// potrzebny. Zmienne są dostępne pod process.env.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =====================================================================
// Stałe geometryczne
// =====================================================================
const CARD_PX = 838;                 // wymiar karty (kwadrat) w pikselach @ 300 dpi
const PX_TO_PT = 72 / 300;           // 1 px @ 300 dpi  →  pkt PDF
const CARD_PT = CARD_PX * PX_TO_PT;  // ~201.12 pt  (≈ 71 mm)

// ↓ Wklej w generate.js zastępując obecny obiekt STYLE oraz stałe
// FRONT_ARTIST_Y / FRONT_YEAR_Y / FRONT_TITLE_Y / QR_CENTER_X / QR_CENTER_Y / QR_SIZE.

const STYLE = {
  artist: {
    family: "Inter",
    weight: 600,
    sizePx: 18,
    color: "#d4a24a",
    letterSpacingPx: 8,
  },
  year: {
    family: "Playfair Display",
    weight: 300,
    sizePx: 180,
    color: "#f1ece1",
    letterSpacingPx: 4.5,
    maxWidth: 340,
    maxHeight: 180,
  },
  title: {
    family: "Inter",
    weight: 400,
    sizePx: 26,
    color: "#e8dfca",
    letterSpacingPx: 0,
  },
  cardNumber: {
    family: "Inter",
    weight: 700,
    sizePx: 28,
    color: "#C9A84C",
    letterSpacingPx: 0,
  },
};

const FRONT_CENTER_X = 419;
const FRONT_ARTIST_Y = 256;
const FRONT_YEAR_Y   = 415;
const FRONT_TITLE_Y  = 583;

const QR_CENTER_X = 419;
const QR_CENTER_Y = 391;
const QR_SIZE     = 417;

// Numer karty pozycjonowany przez paddingi (right/bottom):
//   right: 30
//   bottom: 26

// =====================================================================
// Ścieżki / env
// =====================================================================
// Templates są w public/templates, żeby były dostępne i dla skryptu, i dla
// strony podglądu w przeglądarce (Next.js serwuje wszystko z public/).
// Fallback do ./templates/ na wypadek gdyby ktoś trzymał je po staremu.
const TEMPLATES_DIR = fs.existsSync(path.join(__dirname, 'public', 'templates'))
  ? path.join(__dirname, 'public', 'templates')
  : path.join(__dirname, 'templates');
const OUTPUT_DIR    = path.join(__dirname, 'output');
const FONTS_DIR     = path.join(__dirname, 'fonts');

const FONTS = {
  inter: {
    file: 'Inter-Variable.ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf',
  },
  playfair: {
    file: 'PlayfairDisplay-Variable.ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf',
  },
};

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// =====================================================================
// Helpery
// =====================================================================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function escPango(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function ensureFonts() {
  ensureDir(FONTS_DIR);
  for (const [key, { file, url }] of Object.entries(FONTS)) {
    const filePath = path.join(FONTS_DIR, file);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 1000) {
      console.log(`→ Pobieram font ${file}…`);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(
          `Nie udało się pobrać fontu ${file} z ${url} (HTTP ${res.status}). ` +
            `Pobierz ręcznie do ./fonts/${file}.`,
        );
      }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(filePath, buf);
      console.log(`✓ ${file} (${(buf.length / 1024).toFixed(0)} KB)`);
    }
  }
  installFontsForSharp();
}

// Sharpa bundlowany libvips na macOS ignoruje FONTCONFIG_FILE i sam parametr
// `fontfile` z opcji tekstu (tak, sprawdzone empirycznie). Znajduje za to
// fonty w systemowych ścieżkach — na macu `~/Library/Fonts/`. Kopiujemy
// tam variable TTF-y; macOS i tak je obsłuży globalnie, więc to też się
// przyda gdyby chciał ktoś używać tych fontów w innych aplikacjach.
function installFontsForSharp() {
  if (process.platform !== 'darwin') return; // na Linuksie zwykle wystarczy ~/.fonts
  const userFontsDir = path.join(os.homedir(), 'Library', 'Fonts');
  if (!fs.existsSync(userFontsDir)) return;
  for (const { file } of Object.values(FONTS)) {
    const src = path.join(FONTS_DIR, file);
    const dst = path.join(userFontsDir, file);
    try {
      if (fs.existsSync(dst) && fs.statSync(dst).size === fs.statSync(src).size) continue;
      fs.copyFileSync(src, dst);
      console.log(`✓ Zainstalowano ${file} w ~/Library/Fonts/`);
    } catch (err) {
      console.warn(`⚠ Nie udało się skopiować ${file} do ~/Library/Fonts/: ${err.message}`);
    }
  }
}

// Fonty pobieramy zaraz po starcie i wrzucamy do ~/Library/Fonts/, żeby
// sharp je znalazł (patrz komentarz przy installFontsForSharp).
await ensureFonts();

// Render dowolnego pojedynczego tekstu jako PNG (RGBA). Używamy Pango markup,
// dzięki czemu możemy nadać kolor, wagę i letter-spacing bez SVG.
async function renderText(text, style, fontFile, opts = {}) {
  const safe = String(text ?? '').trim();
  if (!safe) return null;

  // Pango letter_spacing jest w 1/1024 punkta. Przy DPI=72 pkt=px, więc
  // 1 px = 1024 jednostki letter_spacing.
  const ls = Math.round(style.letterSpacingPx * 1024);

  const attrs = [
    `weight="${style.weight}"`,
    `foreground="${style.color}"`,
  ];
  if (ls > 0) attrs.push(`letter_spacing="${ls}"`);

  const markup = `<span ${attrs.join(' ')}>${escPango(safe)}</span>`;

  const text_opts = {
    text: markup,
    font: `${style.family} ${style.sizePx}`,
    fontfile: fontFile,
    rgba: true,
    dpi: 72,
  };
  if (opts.width) text_opts.width = opts.width;

  const img = sharp({ text: text_opts });
  const buf = await img.png().toBuffer();
  const meta = await sharp(buf).metadata();
  return { buf, width: meta.width, height: meta.height };
}

// Auto-shrink: jeśli wyrenderowany tekst przekracza maxWidth, zmniejszaj font
// w krokach co 2 px (do podanego minimum) i renderuj ponownie.
async function renderTextFit(text, style, fontFile, maxWidth, minSize = 14) {
  let size = style.sizePx;
  let result = null;
  while (size >= minSize) {
    result = await renderText(text, { ...style, sizePx: size }, fontFile);
    if (!result) return null;
    if (result.width <= maxWidth) break;
    size -= 2;
  }
  return result;
}

// =====================================================================
// Karty: front
// =====================================================================

async function makeFront(templateBuf, song, cardNumber, fonts) {
  const cardNo = String(cardNumber).padStart(3, '0');
  const maxTextWidth = Math.round(CARD_PX * 0.86); // 86% szerokości karty

  const artist = (song.artist || '').toUpperCase().trim();
  const title  = (song.title  || '').trim();
  const year   = String(song.year ?? '').trim();

  const [artistImg, yearImg, titleImg, numberImg] = await Promise.all([
    renderTextFit(artist, STYLE.artist, fonts.inter, maxTextWidth, 12),
    // Rok ma własny max-width 340 px (tak chciał użytkownik).
    renderTextFit(year, STYLE.year, fonts.playfair, STYLE.year.maxWidth, 80),
    renderTextFit(title, STYLE.title, fonts.inter, maxTextWidth, 12),
    renderText(cardNo, STYLE.cardNumber, fonts.inter),
  ]);

  const composites = [];

  function place(img, centerX, centerY) {
    if (!img) return;
    const left = Math.round(centerX - img.width / 2);
    const top = Math.round(centerY - img.height / 2);
    composites.push({ input: img.buf, top, left });
  }

  place(artistImg, FRONT_CENTER_X, FRONT_ARTIST_Y);
  place(yearImg,   FRONT_CENTER_X, FRONT_YEAR_Y);
  place(titleImg,  FRONT_CENTER_X, FRONT_TITLE_Y);

  // Numer karty: prawy-dolny róg, wyrównany do prawej.
  if (numberImg) {
    composites.push({
      input: numberImg.buf,
      top: CARD_PX - numberImg.height - 26,
      left: CARD_PX - numberImg.width - 30,
    });
  }

  return await sharp(templateBuf).composite(composites).png().toBuffer();
}

// =====================================================================
// Karty: back (QR)
// =====================================================================

async function makeBack(templateBuf, song) {
  const trackId = song.spotify_track_id;
  if (!trackId) {
    console.warn(`  ⚠ Brak spotify_track_id dla "${song.title}" — tył bez QR.`);
    return await sharp(templateBuf).png().toBuffer();
  }

  const url = `https://open.spotify.com/track/${trackId}`;

  const qrBuf = await QRCode.toBuffer(url, {
    type: 'png',
    errorCorrectionLevel: 'H',
    margin: 1,
    width: QR_SIZE,
    color: {
      dark: '#FFFFFFFF',   // wzór QR — biały
      light: '#00000000',  // tło przezroczyste (czarna ramka prześwituje)
    },
  });

  const left = Math.round(QR_CENTER_X - QR_SIZE / 2);
  const top  = Math.round(QR_CENTER_Y - QR_SIZE / 2);

  return await sharp(templateBuf)
    .composite([{ input: qrBuf, top, left }])
    .png()
    .toBuffer();
}

// =====================================================================
// PDF: pojedyncze karty (front, back, front, back…)
// =====================================================================

function writeSinglesPdf(cards, outPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [CARD_PT, CARD_PT],
      margin: 0,
      autoFirstPage: false,
    });

    const stream = fs.createWriteStream(outPath);
    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.pipe(stream);

    for (const { front, back } of cards) {
      doc.addPage({ size: [CARD_PT, CARD_PT], margin: 0 });
      doc.image(front, 0, 0, { width: CARD_PT, height: CARD_PT });
      doc.addPage({ size: [CARD_PT, CARD_PT], margin: 0 });
      doc.image(back, 0, 0, { width: CARD_PT, height: CARD_PT });
    }

    doc.end();
  });
}

// =====================================================================
// PDF: arkusze A4 landscape (3×2) z liniami cięcia
// =====================================================================

function writeSheetPdf(cards, outPath) {
  return new Promise((resolve, reject) => {
    const A4_W_PT = 3508 * PX_TO_PT; // ≈ 841.92 pt
    const A4_H_PT = 2480 * PX_TO_PT; // ≈ 595.20 pt

    const COLS = 3;
    const ROWS = 2;
    const GAP_PT  = 20 * PX_TO_PT;
    const CROP_PT = 15 * PX_TO_PT;

    const gridW = COLS * CARD_PT + (COLS - 1) * GAP_PT;
    const gridH = ROWS * CARD_PT + (ROWS - 1) * GAP_PT;
    const marginX = (A4_W_PT - gridW) / 2;
    const marginY = (A4_H_PT - gridH) / 2;

    const perSheet = COLS * ROWS;

    const doc = new PDFDocument({
      size: [A4_W_PT, A4_H_PT],
      margin: 0,
      autoFirstPage: false,
    });

    const stream = fs.createWriteStream(outPath);
    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.pipe(stream);

    function drawCardAt(image, idx) {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const x = marginX + col * (CARD_PT + GAP_PT);
      const y = marginY + row * (CARD_PT + GAP_PT);

      doc.image(image, x, y, { width: CARD_PT, height: CARD_PT });

      // Linie cięcia: 15 px kreski w czterech rogach, na zewnątrz karty.
      doc.save();
      doc.lineWidth(0.5).strokeColor('#888888');
      const corners = [
        { cx: x,           cy: y,           dx: -1, dy: -1 },
        { cx: x + CARD_PT, cy: y,           dx:  1, dy: -1 },
        { cx: x,           cy: y + CARD_PT, dx: -1, dy:  1 },
        { cx: x + CARD_PT, cy: y + CARD_PT, dx:  1, dy:  1 },
      ];
      for (const { cx, cy, dx, dy } of corners) {
        doc.moveTo(cx, cy).lineTo(cx + dx * CROP_PT, cy).stroke();
        doc.moveTo(cx, cy).lineTo(cx, cy + dy * CROP_PT).stroke();
      }
      doc.restore();
    }

    function addSheet(images) {
      doc.addPage({ size: [A4_W_PT, A4_H_PT], margin: 0 });
      images.forEach((img, i) => drawCardAt(img, i));
    }

    for (let i = 0; i < cards.length; i += perSheet) {
      addSheet(cards.slice(i, i + perSheet).map((c) => c.front));
    }
    for (let i = 0; i < cards.length; i += perSheet) {
      addSheet(cards.slice(i, i + perSheet).map((c) => c.back));
    }

    doc.end();
  });
}

// =====================================================================
// Main
// =====================================================================

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      'Brak SUPABASE_URL / SUPABASE_ANON_KEY w .env lub .env.local. ' +
        'Akceptowane są też NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
        '(Bun czyta .env i .env.local automatycznie — sprawdź, czy plik leży w tym katalogu.)',
    );
  }

  ensureDir(OUTPUT_DIR);

  const templateFrontPath = path.join(TEMPLATES_DIR, 'vinyl-001-front.png');
  const templateBackPath  = path.join(TEMPLATES_DIR, 'vinyl-001-back.png');

  if (!fs.existsSync(templateFrontPath) || !fs.existsSync(templateBackPath)) {
    throw new Error(
      `Nie znaleziono szablonów w ${TEMPLATES_DIR}. ` +
        `Wymagane pliki: vinyl-001-front.png, vinyl-001-back.png`,
    );
  }

  // ensureFonts() już się wykonało jako top-level await.
  const fonts = {
    inter: path.join(FONTS_DIR, FONTS.inter.file),
    playfair: path.join(FONTS_DIR, FONTS.playfair.file),
  };

  const templateFront = fs.readFileSync(templateFrontPath);
  const templateBack  = fs.readFileSync(templateBackPath);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('→ Pobieram piosenki z Supabase…');
  const { data: songs, error } = await supabase
    .from('songs')
    .select('*')
    .order('added_at', { ascending: true });

  if (error) throw error;
  if (!songs || songs.length === 0) {
    console.log('Brak piosenek w bazie — nie mam z czego generować kart.');
    return;
  }

  console.log(`✓ Pobrano ${songs.length} piosenek.\n`);

  const cards = [];
  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    const n = i + 1;
    const label = `${song.artist || '???'} - ${song.title || '???'} (${song.year ?? '????'})`;
    console.log(`Generuję kartę ${n}/${songs.length}: ${label}`);

    const [front, back] = await Promise.all([
      makeFront(templateFront, song, n, fonts),
      makeBack(templateBack, song),
    ]);
    cards.push({ front, back, label });
  }

  const singlesPath = path.join(OUTPUT_DIR, 'hitster-print-SINGLES.pdf');
  const sheetPath   = path.join(OUTPUT_DIR, 'hitster-print-SHEET.pdf');

  console.log('\n→ Składam SINGLES PDF…');
  await writeSinglesPdf(cards, singlesPath);
  console.log(`✓ ${path.relative(__dirname, singlesPath)}`);

  console.log('→ Składam SHEET PDF (A4, 3×2)…');
  await writeSheetPdf(cards, sheetPath);
  console.log(`✓ ${path.relative(__dirname, sheetPath)}`);

  console.log('\nGotowe! Pliki czekają w ./output/.');
}

main().catch((err) => {
  console.error('\n❌ Błąd:', err.message || err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
