"use client"

import { useEffect, useState, type CSSProperties } from "react"
import QRCode from "qrcode"
import { CARD_SIZE, type CardStyle, type TextStyle } from "@/lib/card-style"

export type CardCanvasSong = {
  artist?: string | null
  title?: string | null
  year?: number | null
  spotify_track_id?: string | null
}

type Props = {
  song: CardCanvasSong
  cardNumber: number
  side: "front" | "back"
  style: CardStyle
  /** Skala wizualna (np. 0.6 = pokaż 838px karty jako 502.8px). */
  scale?: number
  /** Pokaż linie pomocnicze (max-w/max-h dla roku, środki tekstów). */
  showGuides?: boolean
  /** URL-e custom szablonów (np. z Supabase Storage). Gdy brak — fallback do domyślnych. */
  templateFrontUrl?: string | null
  templateBackUrl?: string | null
}

const DEFAULT_TEMPLATE_FRONT = "/templates/vinyl-001-front.png"
const DEFAULT_TEMPLATE_BACK = "/templates/vinyl-001-back.png"

export function CardCanvas({
  song,
  cardNumber,
  side,
  style,
  scale = 1,
  showGuides = false,
  templateFrontUrl,
  templateBackUrl,
}: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (side !== "back" || !song.spotify_track_id) {
      // Reset asynchronicznie, żeby uniknąć cascading-render lint w React 19.
      queueMicrotask(() => {
        if (!cancelled) setQrDataUrl(null)
      })
      return () => {
        cancelled = true
      }
    }
    QRCode.toDataURL(
      `https://open.spotify.com/track/${song.spotify_track_id}`,
      {
        errorCorrectionLevel: "H",
        margin: 1,
        width: style.qr.size,
        color: { dark: "#FFFFFFFF", light: "#00000000" },
      },
    )
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [side, song.spotify_track_id, style.qr.size])

  const wrapperStyle: CSSProperties = {
    width: CARD_SIZE,
    height: CARD_SIZE,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
  }

  // Kontener "scenografii" musi mieć fizyczną wielkość po skalowaniu —
  // inaczej layout dookoła pomyśli, że ma 838px. Wrapper zewnętrzny ma
  // realne wymiary (po skalowaniu), wewnętrzny — pełne 838px.
  const outerStyle: CSSProperties = {
    width: CARD_SIZE * scale,
    height: CARD_SIZE * scale,
  }

  return (
    <div style={outerStyle} className="relative">
      <div style={wrapperStyle} className="relative select-none">
        <img
          src={
            side === "front"
              ? templateFrontUrl ?? DEFAULT_TEMPLATE_FRONT
              : templateBackUrl ?? DEFAULT_TEMPLATE_BACK
          }
          alt=""
          width={CARD_SIZE}
          height={CARD_SIZE}
          draggable={false}
          className="absolute inset-0"
        />

        {side === "front" && (
          <>
            <CenteredText
              x={CARD_SIZE / 2}
              y={style.artist.centerY}
              text={(song.artist || "").toUpperCase()}
              style={style.artist}
            />
            <CenteredText
              x={CARD_SIZE / 2}
              y={style.year.centerY}
              text={String(song.year ?? "")}
              style={style.year}
            />
            <CenteredText
              x={CARD_SIZE / 2}
              y={style.title.centerY}
              text={song.title || ""}
              style={style.title}
            />
            <div
              className="absolute whitespace-nowrap"
              style={{
                right: style.cardNumber.rightPadding,
                bottom: style.cardNumber.bottomPadding,
                ...textCss(style.cardNumber),
              }}
            >
              {String(cardNumber).padStart(3, "0")}
            </div>

            {showGuides && (
              <>
                <Guide
                  x={CARD_SIZE / 2 - style.year.maxWidth / 2}
                  y={style.year.centerY - style.year.maxHeight / 2}
                  w={style.year.maxWidth}
                  h={style.year.maxHeight}
                />
                <CenterLine y={style.artist.centerY} />
                <CenterLine y={style.year.centerY} />
                <CenterLine y={style.title.centerY} />
              </>
            )}
          </>
        )}

        {side === "back" && (
          <>
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt=""
                width={style.qr.size}
                height={style.qr.size}
                draggable={false}
                className="absolute"
                style={{
                  left: style.qr.centerX - style.qr.size / 2,
                  top: style.qr.centerY - style.qr.size / 2,
                }}
              />
            )}
            {showGuides && (
              <Guide
                x={style.qr.centerX - style.qr.size / 2}
                y={style.qr.centerY - style.qr.size / 2}
                w={style.qr.size}
                h={style.qr.size}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function CenteredText({
  x,
  y,
  text,
  style,
}: {
  x: number
  y: number
  text: string
  style: TextStyle
}) {
  return (
    <div
      className="absolute whitespace-nowrap"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        // letter-spacing dodaje pusty „trailing slot" za ostatnim znakiem —
        // żeby blok wyglądał na wycentrowany optycznie, ucinamy go
        // ujemnym marginesem po prawej (przesuwa wizualne centrum w lewo
        // o ~połowę letter-spacing).
        marginRight: style.letterSpacingPx ? -style.letterSpacingPx : 0,
        ...textCss(style),
      }}
    >
      {text}
    </div>
  )
}

function textCss(style: TextStyle): CSSProperties {
  const family =
    style.family === "Playfair Display"
      ? "var(--font-playfair), serif"
      : "var(--font-sans), system-ui, sans-serif"
  return {
    fontFamily: family,
    fontWeight: style.weight,
    fontSize: style.sizePx,
    color: style.color,
    letterSpacing: style.letterSpacingPx,
    fontStyle: style.italic ? "italic" : "normal",
    lineHeight: 1,
  }
}

function Guide({
  x,
  y,
  w,
  h,
}: {
  x: number
  y: number
  w: number
  h: number
}) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        outline: "1px dashed rgba(255, 0, 128, 0.6)",
      }}
    />
  )
}

function CenterLine({ y }: { y: number }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: 0,
        right: 0,
        top: y,
        height: 0,
        borderTop: "1px dashed rgba(0, 200, 255, 0.45)",
      }}
    />
  )
}
