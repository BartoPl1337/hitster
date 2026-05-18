import { NextRequest } from "next/server"

interface TokenCache {
  token: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error("Spotify credentials not configured")
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`Failed to get Spotify token: ${res.status}`)
  }

  const data = await res.json()

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }

  return tokenCache.token
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")

  if (!query || query.length < 2) {
    return Response.json({ tracks: [] })
  }

  try {
    const token = await getAccessToken()

    const searchUrl = `https://api.spotify.com/v1/search?type=track&limit=8&q=${encodeURIComponent(query)}`

    let res = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    })

    if (res.status === 401) {
      tokenCache = null
      const freshToken = await getAccessToken()
      res = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${freshToken}` },
        next: { revalidate: 300 },
      })
    }

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
    const tracks = data.tracks.items.map((item: any) => ({
      id: item.id,
      title: item.name,
      artist: item.artists.map((a: { name: string }) => a.name).join(", "),
      year: item.album.release_date
        ? parseInt(item.album.release_date.split("-")[0])
        : null,
      albumCover:
        item.album.images[1]?.url ?? item.album.images[0]?.url ?? null,
    }))

    return Response.json({ tracks })
  } catch (error) {
    console.error("Spotify search error:", error)
    return Response.json({ error: "Failed to search" }, { status: 500 })
  }
}
