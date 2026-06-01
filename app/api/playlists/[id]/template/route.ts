import { createClient } from "@/lib/supabase"

type Params = { params: Promise<{ id: string }> }

const BUCKET = "card-templates"
const MAX_SIZE = 8 * 1024 * 1024 // 8 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"]

export async function POST(req: Request, { params }: Params) {
  const { id } = await params

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: "Niepoprawny multipart" }, { status: 400 })
  }

  const side = form.get("side")
  const file = form.get("file")

  if (side !== "front" && side !== "back") {
    return Response.json({ error: "side musi być 'front' lub 'back'" }, { status: 400 })
  }

  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "Brak pliku" }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return Response.json(
      { error: `Plik za duży (max ${Math.round(MAX_SIZE / 1024 / 1024)} MB)` },
      { status: 400 }
    )
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json(
      { error: "Dopuszczalne formaty: PNG, JPG, WEBP" },
      { status: 400 }
    )
  }

  const supabase = createClient()

  const { data: playlist, error: plErr } = await supabase
    .from("playlists")
    .select("id")
    .eq("id", id)
    .maybeSingle()

  if (plErr || !playlist) {
    return Response.json({ error: "Lista nie istnieje" }, { status: 404 })
  }

  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
  const objectPath = `${id}/${side}-${Date.now()}.${ext}`

  const buf = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, buf, {
      contentType: file.type,
      upsert: false,
      cacheControl: "3600",
    })

  if (upErr) {
    return Response.json(
      { error: `Storage error: ${upErr.message}` },
      { status: 500 }
    )
  }

  const column = side === "front" ? "template_front_path" : "template_back_path"

  // Zwolnij poprzedni szablon — odczytaj starą ścieżkę, podmień, skasuj.
  const { data: prev } = await supabase
    .from("playlists")
    .select(column)
    .eq("id", id)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prevPath = (prev as any)?.[column] as string | null | undefined

  const { error: updErr } = await supabase
    .from("playlists")
    .update({ [column]: objectPath })
    .eq("id", id)

  if (updErr) {
    await supabase.storage.from(BUCKET).remove([objectPath])
    return Response.json({ error: updErr.message }, { status: 500 })
  }

  if (prevPath && prevPath !== objectPath) {
    await supabase.storage.from(BUCKET).remove([prevPath])
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath)

  return Response.json({
    path: objectPath,
    publicUrl: pub.publicUrl,
  })
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const side = searchParams.get("side")

  if (side !== "front" && side !== "back") {
    return Response.json({ error: "side musi być 'front' lub 'back'" }, { status: 400 })
  }

  const column = side === "front" ? "template_front_path" : "template_back_path"
  const supabase = createClient()

  const { data: prev } = await supabase
    .from("playlists")
    .select(column)
    .eq("id", id)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prevPath = (prev as any)?.[column] as string | null | undefined

  await supabase
    .from("playlists")
    .update({ [column]: null })
    .eq("id", id)

  if (prevPath) {
    await supabase.storage.from(BUCKET).remove([prevPath])
  }

  return Response.json({ ok: true })
}
