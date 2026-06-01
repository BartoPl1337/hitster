"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  RotateCcw,
  Eye,
  EyeOff,
  ArrowLeft,
  Download,
  Upload,
  X,
  Loader2,
  Check,
  CloudOff,
} from "lucide-react"
import { CardCanvas, type CardCanvasSong } from "@/components/card-canvas"
import {
  CARD_SIZE,
  DEFAULT_STYLE,
  type CardStyle,
  type TextStyle,
} from "@/lib/card-style"

export type PreviewSong = CardCanvasSong & {
  id: string
  added_at?: string
}

type Element = "artist" | "year" | "title" | "cardNumber" | "qr"

type SaveStatus = "idle" | "saving" | "saved" | "error"

function mergeStyle(saved: unknown): CardStyle {
  if (!saved || typeof saved !== "object") return DEFAULT_STYLE
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = saved as any
  return {
    artist: { ...DEFAULT_STYLE.artist, ...(s.artist ?? {}) },
    year: { ...DEFAULT_STYLE.year, ...(s.year ?? {}) },
    title: { ...DEFAULT_STYLE.title, ...(s.title ?? {}) },
    cardNumber: { ...DEFAULT_STYLE.cardNumber, ...(s.cardNumber ?? {}) },
    qr: { ...DEFAULT_STYLE.qr, ...(s.qr ?? {}) },
  }
}

export function CardPreviewClient({
  songs,
  playlistName,
  playlistId,
  initialStyle,
  initialTemplateFrontUrl,
  initialTemplateBackUrl,
}: {
  songs: PreviewSong[]
  playlistName?: string
  playlistId?: string
  initialStyle?: unknown
  initialTemplateFrontUrl?: string | null
  initialTemplateBackUrl?: string | null
}) {
  const searchParams = useSearchParams()
  const initialSongId = searchParams.get("song")

  const [style, setStyle] = useState<CardStyle>(() => mergeStyle(initialStyle))
  const [side, setSide] = useState<"front" | "back">("front")
  // scale: "fit" = auto do szerokości kontenera, lub liczba 0..1.
  const [scale, setScale] = useState<"fit" | number>("fit")
  const [showGuides, setShowGuides] = useState(false)
  const [element, setElement] = useState<Element>("year")
  const canvasFrameRef = useRef<HTMLDivElement>(null)
  const [frameWidth, setFrameWidth] = useState(0)
  const [templateFrontUrl, setTemplateFrontUrl] = useState<string | null>(
    initialTemplateFrontUrl ?? null
  )
  const [templateBackUrl, setTemplateBackUrl] = useState<string | null>(
    initialTemplateBackUrl ?? null
  )
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [uploadingFront, setUploadingFront] = useState(false)
  const [uploadingBack, setUploadingBack] = useState(false)
  const [downloadingLayout, setDownloadingLayout] = useState<
    "sheet" | "singles" | null
  >(null)

  const [songIndex, setSongIndex] = useState(() => {
    if (!songs.length) return 0
    if (initialSongId) {
      const idx = songs.findIndex((s) => s.id === initialSongId)
      if (idx >= 0) return idx
    }
    return 0
  })

  // Synchroniczny pomiar przed paintem — żeby nie było błysku z domyślną skalą
  // przy pierwszym renderze, zwłaszcza na mobile.
  useLayoutEffect(() => {
    const el = canvasFrameRef.current
    if (el) setFrameWidth(el.getBoundingClientRect().width)
  }, [])

  // ResizeObserver dla zmian szerokości (obrót ekranu, resize okna).
  useEffect(() => {
    const el = canvasFrameRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setFrameWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const effectiveScale =
    scale === "fit"
      ? frameWidth > 0
        ? Math.min(1, frameWidth / CARD_SIZE)
        : 0.6
      : scale

  // Auto-save style do API z debounce. Pomijamy pierwszy render — initial
  // wartość już jest na backendzie.
  const isFirstSave = useRef(true)
  useEffect(() => {
    if (!playlistId) return
    if (isFirstSave.current) {
      isFirstSave.current = false
      return
    }

    setSaveStatus("saving")
    const timer = setTimeout(() => {
      fetch(`/api/playlists/${playlistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardStyle: style }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status))
          setSaveStatus("saved")
          setTimeout(() => setSaveStatus("idle"), 1500)
        })
        .catch(() => {
          setSaveStatus("error")
        })
    }, 600)

    return () => clearTimeout(timer)
  }, [style, playlistId])

  const currentSong = songs[songIndex]
  const cardNumber = songIndex + 1

  function patch<K extends keyof CardStyle>(
    key: K,
    next: Partial<CardStyle[K]>
  ) {
    setStyle((prev) => ({ ...prev, [key]: { ...prev[key], ...next } }))
  }

  function resetAll() {
    if (!confirm("Przywrócić wszystkie ustawienia stylu do domyślnych?")) return
    setStyle(DEFAULT_STYLE)
    toast.success("Przywrócono ustawienia domyślne")
  }

  async function uploadTemplate(file: File, which: "front" | "back") {
    if (!playlistId) return
    const setUploading = which === "front" ? setUploadingFront : setUploadingBack
    const setUrl = which === "front" ? setTemplateFrontUrl : setTemplateBackUrl
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("side", which)
      const res = await fetch(`/api/playlists/${playlistId}/template`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Błąd uploadu")
        return
      }
      setUrl(data.publicUrl)
      toast.success(`Wgrano szablon (${which === "front" ? "przód" : "tył"})`)
    } catch {
      toast.error("Nie udało się wgrać szablonu")
    } finally {
      setUploading(false)
    }
  }

  async function clearTemplate(which: "front" | "back") {
    if (!playlistId) return
    if (
      !confirm(
        `Usunąć wgrany szablon (${which === "front" ? "przód" : "tył"}) i wrócić do domyślnego?`
      )
    ) {
      return
    }
    try {
      const res = await fetch(
        `/api/playlists/${playlistId}/template?side=${which}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        toast.error("Nie udało się usunąć szablonu")
        return
      }
      if (which === "front") setTemplateFrontUrl(null)
      else setTemplateBackUrl(null)
      toast.success("Szablon usunięty")
    } catch {
      toast.error("Wystąpił błąd")
    }
  }

  async function downloadPdf(layout: "sheet" | "singles") {
    if (!playlistId) return
    setDownloadingLayout(layout)
    try {
      const res = await fetch(
        `/api/playlists/${playlistId}/generate?layout=${layout}`
      )
      if (!res.ok) {
        const ct = res.headers.get("content-type") ?? ""
        const msg = ct.includes("json")
          ? (await res.json()).error
          : "Nie udało się wygenerować PDF"
        toast.error(msg)
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get("content-disposition") ?? ""
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? `hitster-${layout}.pdf`

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Pobrano ${filename}`)
    } catch {
      toast.error("Nie udało się pobrać PDF")
    } finally {
      setDownloadingLayout(null)
    }
  }

  if (songs.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        {playlistId && (
          <Link
            href="/preview"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Wybierz inną listę
          </Link>
        )}
        <p className="text-muted-foreground">
          Brak piosenek na tej liście — najpierw dodaj kilka, żeby było co
          podglądać.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      {playlistId && (
        <Link
          href="/preview"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Wybierz inną listę
        </Link>
      )}
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <div className="mr-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Podgląd karty</h1>
            <SaveBadge status={saveStatus} />
          </div>
          {playlistName && (
            <p className="text-sm text-muted-foreground">
              Lista:{" "}
              <span className="font-medium text-foreground">{playlistName}</span>
            </p>
          )}
        </div>

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
            { value: "fit", label: "Auto" },
            { value: 0.5, label: "50%" },
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
          {showGuides ? (
            <EyeOff className="mr-1 size-4" />
          ) : (
            <Eye className="mr-1 size-4" />
          )}
          Linie
        </Button>

        <TemplateButton
          side="front"
          url={templateFrontUrl}
          uploading={uploadingFront}
          onUpload={(f) => uploadTemplate(f, "front")}
          onClear={() => clearTemplate("front")}
        />
        <TemplateButton
          side="back"
          url={templateBackUrl}
          uploading={uploadingBack}
          onUpload={(f) => uploadTemplate(f, "back")}
          onClear={() => clearTemplate("back")}
        />

        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={resetAll}>
            <RotateCcw className="mr-1 size-4" />
            Reset stylu
          </Button>
          <Button
            size="sm"
            onClick={() => downloadPdf("singles")}
            disabled={downloadingLayout !== null}
          >
            {downloadingLayout === "singles" ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Download className="mr-1 size-4" />
            )}
            Pojedyncze karty
          </Button>
          <Button
            size="sm"
            onClick={() => downloadPdf("sheet")}
            disabled={downloadingLayout !== null}
          >
            {downloadingLayout === "sheet" ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Download className="mr-1 size-4" />
            )}
            Arkusze A4
          </Button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="text-sm text-muted-foreground">Piosenka:</label>
        <select
          value={songIndex}
          onChange={(e) => setSongIndex(Number(e.target.value))}
          className="min-w-0 max-w-full flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm sm:flex-initial"
        >
          {songs.map((s, i) => (
            <option key={s.id} value={i}>
              #{String(i + 1).padStart(3, "0")} — {s.artist} — {s.title}
              {s.year ? ` (${s.year})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Canvas */}
        <Card className="overflow-auto">
          <CardContent className="p-3 sm:p-6">
            <div
              ref={canvasFrameRef}
              className="mx-auto flex w-full justify-center"
            >
              {currentSong && (
                <div
                  className="relative"
                  style={{
                    width: CARD_SIZE * effectiveScale,
                    height: CARD_SIZE * effectiveScale,
                  }}
                >
                  <CardCanvas
                    song={currentSong}
                    cardNumber={cardNumber}
                    side={side}
                    style={style}
                    scale={effectiveScale}
                    showGuides={showGuides}
                    templateFrontUrl={templateFrontUrl}
                    templateBackUrl={templateBackUrl}
                  />
                </div>
              )}
            </div>
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
                    onChange={(v) =>
                      patch("cardNumber", { rightPadding: v })
                    }
                  />
                  <NumberRow
                    label="Bottom padding"
                    value={style.cardNumber.bottomPadding}
                    min={0}
                    max={120}
                    onChange={(v) =>
                      patch("cardNumber", { bottomPadding: v })
                    }
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
            Zmiany stylu zapisują się automatycznie do listy.
            &bdquo;Pobierz&rdquo; generuje PDF z aktualnym stylem i szablonem.
          </p>
        </div>
      </div>
    </main>
  )
}

// =====================================================================
// Pod-komponenty
// =====================================================================

function SaveBadge({ status }: { status: SaveStatus }) {
  if (status === "idle") return null
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Zapisywanie…
      </span>
    )
  }
  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600">
        <Check className="size-3" />
        Zapisano
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-destructive">
      <CloudOff className="size-3" />
      Błąd zapisu
    </span>
  )
}

function TemplateButton({
  side,
  url,
  uploading,
  onUpload,
  onClear,
}: {
  side: "front" | "back"
  url: string | null
  uploading: boolean
  onUpload: (file: File) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const label = side === "front" ? "Przód" : "Tył"
  const hasCustom = !!url

  return (
    <div className="inline-flex items-center">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onUpload(f)
          e.target.value = ""
        }}
      />
      <Button
        variant={hasCustom ? "secondary" : "outline"}
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={hasCustom ? "rounded-r-none border-r-0" : ""}
        title={
          hasCustom
            ? `Własny szablon (${label.toLowerCase()}) — kliknij, by podmienić`
            : `Wgraj własny ${label.toLowerCase()}`
        }
      >
        {uploading ? (
          <Loader2 className="mr-1 size-4 animate-spin" />
        ) : (
          <Upload className="mr-1 size-4" />
        )}
        {label}
        {hasCustom && !uploading && (
          <span className="ml-1.5 inline-block size-1.5 rounded-full bg-primary" />
        )}
      </Button>
      {hasCustom && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onClear}
          disabled={uploading}
          aria-label={`Usuń własny ${label.toLowerCase()}`}
          title={`Wróć do domyślnego (${label.toLowerCase()})`}
          className="rounded-l-none border-l border-border px-2"
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  )
}

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
