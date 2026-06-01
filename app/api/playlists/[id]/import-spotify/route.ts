import { createClient } from "@/lib/supabase"
import { parseSpotifyUrl, spotifyFetch } from "@/lib/spotify"

type Params = { params: Promise<{ id: string }> }

type SpotifyArtist = { id: string; name: string }
type SpotifyImage = { url: string; width: number | null }
type SpotifyTrack = {
  id: string
  name: string
  artists: SpotifyArtist[]
  album: {
    release_date: string | null
    images: SpotifyImage[]
  }
}

type CollectedTrack = {
  id: string
  title: string
  artist: string
  year: number | null
  albumCover: string | null
  primaryArtistId: string | null
}

const MAX_TRACKS = 500

function pickArtistFromTrack(track: SpotifyTrack): {
  joined: string
  primaryId: string | null
} {
  const names = track.artists?.map((a) => a.name).filter(Boolean) ?? []
  return {
    joined: names.join(", "),
    primaryId: track.artists?.[0]?.id ?? null,
  }
}

function pickCover(images: SpotifyImage[] | undefined): string | null {
  if (!images || images.length === 0) return null
  return images[1]?.url ?? images[0]?.url ?? null
}

function yearOf(releaseDate: string | null | undefined): number | null {
  if (!releaseDate) return null
  const y = parseInt(releaseDate.split("-")[0], 10)
  return Number.isFinite(y) ? y : null
}

async function fetchPlaylistTracks(playlistId: string): Promise<CollectedTrack[]> {
  const results: CollectedTrack[] = []
  // market=PL ogranicza zwroty do treści dostępnej w Polsce — czasem ratuje
  // przed 403 gdy bez market jest niejednoznaczna dostępność.
  let url:
    | string
    | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?market=PL&fields=items(track(id,name,artists(id,name),album(release_date,images))),next&limit=100`

  while (url && results.length < MAX_TRACKS) {
    const res = await spotifyFetch(url)
    if (!res.ok) {
      let bodyText = ""
      try {
        bodyText = await res.text()
      } catch {
        /* ignore */
      }
      throw new Error(
        `Spotify playlist fetch failed: ${res.status}${bodyText ? ` — ${bodyText.slice(0, 300)}` : ""}`
      )
    }
    const data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: any[]
      next: string | null
    } = await res.json()

    for (const item of data.items ?? []) {
      const track: SpotifyTrack | null = item?.track
      if (!track || !track.id) continue
      const { joined, primaryId } = pickArtistFromTrack(track)
      results.push({
        id: track.id,
        title: track.name,
        artist: joined,
        year: yearOf(track.album?.release_date),
        albumCover: pickCover(track.album?.images),
        primaryArtistId: primaryId,
      })
    }
    url = data.next
  }

  return results
}

async function fetchAlbumTracks(albumId: string): Promise<CollectedTrack[]> {
  // Najpierw album-level info (release_date, images), bo /albums/{id}/tracks
  // nie zwraca tych pól dla pojedynczych utworów.
  const albumRes = await spotifyFetch(
    `https://api.spotify.com/v1/albums/${albumId}?fields=release_date,images,name`
  )
  if (!albumRes.ok) {
    throw new Error(`Spotify album fetch failed: ${albumRes.status}`)
  }
  const albumData = await albumRes.json()
  const albumYear = yearOf(albumData.release_date)
  const albumCover = pickCover(albumData.images)

  const results: CollectedTrack[] = []
  let url:
    | string
    | null = `https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`

  while (url && results.length < MAX_TRACKS) {
    const res = await spotifyFetch(url)
    if (!res.ok) {
      throw new Error(`Spotify album tracks fetch failed: ${res.status}`)
    }
    const data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: any[]
      next: string | null
    } = await res.json()

    for (const item of data.items ?? []) {
      if (!item?.id) continue
      const { joined, primaryId } = pickArtistFromTrack(item)
      results.push({
        id: item.id,
        title: item.name,
        artist: joined,
        year: albumYear,
        albumCover,
        primaryArtistId: primaryId,
      })
    }
    url = data.next
  }

  return results
}

async function fetchArtistGenres(
  artistIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  for (let i = 0; i < artistIds.length; i += 50) {
    const batch = artistIds.slice(i, i + 50).join(",")
    const res = await spotifyFetch(
      `https://api.spotify.com/v1/artists?ids=${batch}`
    )
    if (!res.ok) continue
    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const artist of data.artists ?? []) {
      if (artist?.id) {
        map.set(artist.id, Array.isArray(artist.genres) ? artist.genres : [])
      }
    }
  }
  return map
}

export async function POST(req: Request, { params }: Params) {
  const { id: playlistId } = await params
  const body = await req.json().catch(() => null)

  const rawUrl = typeof body?.url === "string" ? body.url : ""
  const addedBy = typeof body?.addedBy === "string" ? body.addedBy.trim() : ""

  if (!addedBy) {
    return Response.json({ error: "Brak imienia / nicku" }, { status: 400 })
  }

  const parsed = parseSpotifyUrl(rawUrl)
  if (!parsed) {
    return Response.json(
      {
        error:
          "Niepoprawny URL Spotify. Wklej link do playlisty lub albumu (open.spotify.com/playlist/... lub /album/...).",
      },
      { status: 400 }
    )
  }

  const supabase = createClient()

  const { data: playlist } = await supabase
    .from("playlists")
    .select("id")
    .eq("id", playlistId)
    .maybeSingle()

  if (!playlist) {
    return Response.json({ error: "Lista nie istnieje" }, { status: 404 })
  }

  let tracks: CollectedTrack[]
  try {
    tracks =
      parsed.type === "playlist"
        ? await fetchPlaylistTracks(parsed.id)
        : await fetchAlbumTracks(parsed.id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Nieznany błąd"
    console.error("[import-spotify] error:", msg)
    if (msg.includes("404")) {
      return Response.json(
        { error: "Spotify zwrócił 404. Czy URL jest poprawny i playlista publiczna?" },
        { status: 404 }
      )
    }
    if (msg.includes("403")) {
      return Response.json(
        {
          error:
            'Spotify zwrócił 403. Najpewniej twoja aplikacja Spotify jest w trybie Development — w tym trybie API nie pozwala czytać playlist, których nie utworzyło konto powiązane z aplikacją. Rozwiązania: (1) wejdź na developer.spotify.com/dashboard → twoja aplikacja → "Extension Request" i poproś o tryb produkcyjny, lub (2) zaimportuj playlistę utworzoną przez twoje konto Spotify (to samo, którym założyłeś aplikację).',
          raw: msg,
        },
        { status: 403 }
      )
    }
    return Response.json({ error: msg }, { status: 502 })
  }

  if (tracks.length === 0) {
    return Response.json({
      imported: 0,
      skipped: 0,
      total: 0,
      message: "Brak utworów do zaimportowania.",
    })
  }

  // Deduplikuj wewnątrz samego importu (np. ten sam utwór 2x w playliście)
  const uniqueTracksMap = new Map<string, CollectedTrack>()
  for (const t of tracks) {
    if (!uniqueTracksMap.has(t.id)) uniqueTracksMap.set(t.id, t)
  }
  const uniqueTracks = [...uniqueTracksMap.values()]

  // Pobierz istniejące spotify_track_id w tej liście (żeby pominąć duplikaty)
  const trackIds = uniqueTracks.map((t) => t.id)
  const { data: existing } = await supabase
    .from("songs")
    .select("spotify_track_id")
    .eq("playlist_id", playlistId)
    .in("spotify_track_id", trackIds)

  const existingSet = new Set(
    (existing ?? []).map((r) => r.spotify_track_id as string)
  )

  const toInsert = uniqueTracks.filter((t) => !existingSet.has(t.id))
  const skipped = uniqueTracks.length - toInsert.length

  if (toInsert.length === 0) {
    return Response.json({
      imported: 0,
      skipped,
      total: uniqueTracks.length,
    })
  }

  // Pobierz gatunki dla wszystkich primary artists
  const uniqueArtistIds = Array.from(
    new Set(
      toInsert
        .map((t) => t.primaryArtistId)
        .filter((id): id is string => typeof id === "string")
    )
  )

  let genresMap = new Map<string, string[]>()
  try {
    genresMap = await fetchArtistGenres(uniqueArtistIds)
  } catch {
    // gatunki opcjonalne — w razie błędu lecimy dalej bez nich
  }

  const rows = toInsert.map((t) => {
    const genres = (
      t.primaryArtistId ? genresMap.get(t.primaryArtistId) ?? [] : []
    ).slice(0, 5)
    return {
      playlist_id: playlistId,
      added_by: addedBy,
      spotify_track_id: t.id,
      title: t.title,
      artist: t.artist,
      album_cover: t.albumCover,
      year: t.year,
      genres,
    }
  })

  const { error: insertErr } = await supabase.from("songs").insert(rows)
  if (insertErr) {
    return Response.json(
      { error: `DB insert failed: ${insertErr.message}` },
      { status: 500 }
    )
  }

  return Response.json({
    imported: toInsert.length,
    skipped,
    total: uniqueTracks.length,
  })
}
