import { NextRequest } from "next/server"
import { spotifyFetch } from "@/lib/spotify"

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")

  if (!query || query.length < 2) {
    return Response.json({ tracks: [] })
  }

  try {
    const searchUrl = `https://api.spotify.com/v1/search?type=track&limit=8&q=${encodeURIComponent(query)}`
    const res = await spotifyFetch(searchUrl, { next: { revalidate: 300 } })

    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After") ?? "10"
      return Response.json(
        { error: "rate_limited", retryAfter: parseInt(retryAfter) },
        { status: 429 }
      )
    }

    if (!res.ok) {
      return Response.json({ error: "Spotify API error" }, { status: 502 })
    }

    const data = await res.json()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = data.tracks?.items ?? []

    const primaryArtistIds = Array.from(
      new Set(
        items
          .map((item) => item.artists?.[0]?.id)
          .filter((id): id is string => typeof id === "string")
      )
    )

    const artistGenres = new Map<string, string[]>()

    if (primaryArtistIds.length > 0) {
      const idsParam = primaryArtistIds.slice(0, 50).join(",")
      const artistsRes = await spotifyFetch(
        `https://api.spotify.com/v1/artists?ids=${idsParam}`,
        { next: { revalidate: 86400 } }
      )

      if (artistsRes.ok) {
        const artistsData = await artistsRes.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const artist of artistsData.artists ?? []) {
          if (artist?.id) {
            artistGenres.set(artist.id, artist.genres ?? [])
          }
        }
      }
    }

    const tracks = items.map((item) => {
      const primaryArtistId: string | undefined = item.artists?.[0]?.id
      return {
        id: item.id,
        title: item.name,
        artist: item.artists.map((a: { name: string }) => a.name).join(", "),
        year: item.album.release_date
          ? parseInt(item.album.release_date.split("-")[0])
          : null,
        albumCover:
          item.album.images[1]?.url ?? item.album.images[0]?.url ?? null,
        spotifyGenres: primaryArtistId
          ? artistGenres.get(primaryArtistId) ?? []
          : [],
      }
    })

    return Response.json({ tracks })
  } catch (error) {
    console.error("Spotify search error:", error)
    return Response.json({ error: "Failed to search" }, { status: 500 })
  }
}
