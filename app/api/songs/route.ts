import { createClient } from "@/lib/supabase"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const playlistId = searchParams.get("playlist_id")

  const supabase = createClient()

  let query = supabase.from("songs").select("*").order("added_at", { ascending: false })

  if (playlistId) {
    query = query.eq("playlist_id", playlistId)
  }

  const { data, error } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ songs: data })
}

export async function POST(request: Request) {
  const body = await request.json()
  const {
    addedBy,
    playlistId,
    spotifyTrackId,
    title,
    artist,
    albumCover,
    year,
    genres,
  } = body

  if (!addedBy || !playlistId || !spotifyTrackId || !title || !artist) {
    return Response.json({ error: "Missing required fields" }, { status: 400 })
  }

  const cleanGenres: string[] = Array.isArray(genres)
    ? Array.from(
        new Set(
          genres
            .filter((g: unknown): g is string => typeof g === "string")
            .map((g) => g.trim())
            .filter((g) => g.length > 0 && g.length <= 40)
        )
      ).slice(0, 5)
    : []

  const supabase = createClient()

  const { data: playlist } = await supabase
    .from("playlists")
    .select("id")
    .eq("id", playlistId)
    .maybeSingle()

  if (!playlist) {
    return Response.json({ error: "Playlist not found" }, { status: 404 })
  }

  const { data: existing } = await supabase
    .from("songs")
    .select("id")
    .eq("playlist_id", playlistId)
    .eq("spotify_track_id", spotifyTrackId)
    .maybeSingle()

  if (existing) {
    return Response.json({ error: "duplicate" }, { status: 409 })
  }

  const { data, error } = await supabase
    .from("songs")
    .insert({
      playlist_id: playlistId,
      added_by: addedBy,
      spotify_track_id: spotifyTrackId,
      title,
      artist,
      album_cover: albumCover ?? null,
      year: year ?? null,
      genres: cleanGenres,
    })
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ song: data }, { status: 201 })
}
