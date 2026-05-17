import { createClient } from "@/lib/supabase"

export async function GET() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("songs")
    .select("*")
    .order("added_at", { ascending: false })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ songs: data })
}

export async function POST(request: Request) {
  const body = await request.json()
  const { addedBy, spotifyTrackId, title, artist, albumCover, year, comment } =
    body

  if (!addedBy || !spotifyTrackId || !title || !artist) {
    return Response.json({ error: "Missing required fields" }, { status: 400 })
  }

  const supabase = createClient()

  const { data: existing } = await supabase
    .from("songs")
    .select("id")
    .eq("spotify_track_id", spotifyTrackId)
    .maybeSingle()

  if (existing) {
    return Response.json({ error: "duplicate" }, { status: 409 })
  }

  const { data, error } = await supabase
    .from("songs")
    .insert({
      added_by: addedBy,
      spotify_track_id: spotifyTrackId,
      title,
      artist,
      album_cover: albumCover ?? null,
      year: year ?? null,
      comment: comment?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ song: data }, { status: 201 })
}
