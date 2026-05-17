// Konfiguracja typografii i pozycji dla karty Hitster.
// Te wartości muszą być zsynchronizowane z `generate.js` (obiekt STYLE +
// stałe FRONT_*_Y oraz QR_*). Po skończonej zabawie w `/preview` użyj
// przycisku "Eksportuj do generate.js", żeby wkleić zaktualizowany snippet.

export const CARD_SIZE = 838 // px, kwadratowa karta w 300 dpi

export type TextStyle = {
  family: "Inter" | "Playfair Display"
  weight: number
  sizePx: number
  color: string
  letterSpacingPx: number
  italic?: boolean
}

export type CardStyle = {
  artist: TextStyle & { centerY: number }
  year: TextStyle & { centerY: number; maxWidth: number; maxHeight: number }
  title: TextStyle & { centerY: number }
  cardNumber: TextStyle & {
    color: string
    rightPadding: number
    bottomPadding: number
  }
  qr: {
    centerX: number
    centerY: number
    size: number
  }
}

export const DEFAULT_STYLE: CardStyle = {
  artist: {
    family: "Inter",
    weight: 600,
    sizePx: 18,
    color: "#d4a24a",
    letterSpacingPx: 8,
    centerY: 305,
  },
  year: {
    family: "Playfair Display",
    weight: 200,
    sizePx: 180,
    color: "#f1ece1",
    letterSpacingPx: 4,
    centerY: 419,
    maxWidth: 340,
    maxHeight: 180,
  },
  title: {
    family: "Inter",
    weight: 400,
    sizePx: 26,
    color: "#e8dfca",
    letterSpacingPx: 0,
    centerY: 535,
  },
  cardNumber: {
    family: "Inter",
    weight: 700,
    sizePx: 28,
    color: "#C9A84C",
    letterSpacingPx: 0,
    rightPadding: 30,
    bottomPadding: 26,
  },
  qr: {
    centerX: 419,
    centerY: 380,
    size: 400,
  },
}

export const STORAGE_KEY = "hister:card-style:v1"
