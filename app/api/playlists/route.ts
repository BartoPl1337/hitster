import { createClient } from "@/lib/supabase"

export async function GET() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("playlists")
    .select("id, name, description, created_at, songs(count)")
    .order("created_at", { ascending: true })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const playlists = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    created_at: p.created_at,
    songCount: Array.isArray(p.songs) ? (p.songs[0]?.count ?? 0) : 0,
  }))

  return Response.json({ playlists })
}

export async function POST(request: Request) {
  const body = await request.json()
  const rawName = typeof body.name === "string" ? body.name.trim() : ""
  const rawDesc = typeof body.description === "string" ? body.description.trim() : ""

  if (!rawName) {
    return Response.json({ error: "Nazwa jest wymagana" }, { status: 400 })
  }

  if (rawName.length > 60) {
    return Response.json({ error: "Nazwa za długa (max 60)" }, { status: 400 })
  }

  if (rawDesc.length > 200) {
    return Response.json({ error: "Opis za długi (max 200)" }, { status: 400 })
  }

  const supabase = createClient()

  const { data: existing } = await supabase
    .from("playlists")
    .select("id")
    .ilike("name", rawName)
    .maybeSingle()

  if (existing) {
    return Response.json({ error: "Lista o tej nazwie już istnieje" }, { status: 409 })
  }

  const { data, error } = await supabase
    .from("playlists")
    .insert({
      name: rawName,
      description: rawDesc || null,
    })
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ playlist: data }, { status: 201 })
}
