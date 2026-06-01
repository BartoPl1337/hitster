import fs from "node:fs"
import path from "node:path"
import { createClient } from "@/lib/supabase"
import { generatePdf, slugifyPlaylistName, type CardSong } from "@/lib/pdf-generator"
import { DEFAULT_STYLE, type CardStyle } from "@/lib/card-style"

export const runtime = "nodejs"
export const maxDuration = 300

type Params = { params: Promise<{ id: string }> }

const BUCKET = "card-templates"

async function loadTemplate(
  supabase: ReturnType<typeof createClient>,
  storagePath: string | null,
  fallbackFile: string
): Promise<Buffer> {
  if (storagePath) {
    const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
    if (error || !data) {
      throw new Error(`Nie udało się pobrać szablonu z Supabase (${storagePath}): ${error?.message ?? "brak"}`)
    }
    return Buffer.from(await data.arrayBuffer())
  }
  const fallbackPath = path.join(process.cwd(), "public", "templates", fallbackFile)
  if (!fs.existsSync(fallbackPath)) {
    throw new Error(`Brak domyślnego szablonu: ${fallbackPath}`)
  }
  return fs.readFileSync(fallbackPath)
}

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

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const layoutParam = searchParams.get("layout")
  const layout: "singles" | "sheet" = layoutParam === "singles" ? "singles" : "sheet"

  const supabase = createClient()

  const { data: playlist, error: plErr } = await supabase
    .from("playlists")
    .select(
      "id, name, card_style, template_front_path, template_back_path"
    )
    .eq("id", id)
    .maybeSingle()

  if (plErr || !playlist) {
    return Response.json({ error: "Lista nie istnieje" }, { status: 404 })
  }

  const { data: songs, error: songsErr } = await supabase
    .from("songs")
    .select("artist, title, year, spotify_track_id")
    .eq("playlist_id", id)
    .order("added_at", { ascending: true })

  if (songsErr) {
    return Response.json({ error: songsErr.message }, { status: 500 })
  }

  if (!songs || songs.length === 0) {
    return Response.json(
      { error: "Brak piosenek na tej liście" },
      { status: 400 }
    )
  }

  try {
    const [templateFront, templateBack] = await Promise.all([
      loadTemplate(
        supabase,
        (playlist.template_front_path as string | null) ?? null,
        "vinyl-001-front.png"
      ),
      loadTemplate(
        supabase,
        (playlist.template_back_path as string | null) ?? null,
        "vinyl-001-back.png"
      ),
    ])

    const style = mergeStyle(playlist.card_style)

    const pdf = await generatePdf({
      songs: songs as CardSong[],
      style,
      templateFront,
      templateBack,
      layout,
    })

    const slug = slugifyPlaylistName(playlist.name as string)
    const suffix = layout === "sheet" ? "SHEET" : "SINGLES"
    const filename = `hitster-${suffix}-${slug}.pdf`

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("[generate] error:", err)
    const msg = err instanceof Error ? err.message : "Nieznany błąd"
    return Response.json({ error: msg }, { status: 500 })
  }
}
