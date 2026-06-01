interface TokenCache {
  token: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

export async function getSpotifyAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error("Spotify credentials not configured")
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  )

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

export function invalidateSpotifyToken() {
  tokenCache = null
}

/**
 * Parsuje URL Spotify do { type, id }. Obsługuje:
 *  - https://open.spotify.com/playlist/{id}?si=...
 *  - https://open.spotify.com/album/{id}
 *  - spotify:playlist:{id}
 *  - spotify:album:{id}
 *  - Sam ID (zakładamy playlist)
 */
export function parseSpotifyUrl(
  raw: string
): { type: "playlist" | "album"; id: string } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const uriMatch = trimmed.match(/^spotify:(playlist|album):([a-zA-Z0-9]+)$/)
  if (uriMatch) {
    return { type: uriMatch[1] as "playlist" | "album", id: uriMatch[2] }
  }

  try {
    const url = new URL(trimmed)
    if (!url.hostname.endsWith("spotify.com")) return null
    const parts = url.pathname.replace(/^\/+/, "").split("/")
    // /playlist/{id}, /album/{id}, /intl-xx/playlist/{id}, etc.
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i] === "playlist" || parts[i] === "album") {
        const id = parts[i + 1]
        if (id && /^[a-zA-Z0-9]+$/.test(id)) {
          return { type: parts[i] as "playlist" | "album", id }
        }
      }
    }
  } catch {
    /* not a URL */
  }

  return null
}

/**
 * Wrapper na fetch ze Spotify — auto-refresh token na 401.
 */
export async function spotifyFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  let token = await getSpotifyAccessToken()
  let res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    invalidateSpotifyToken()
    token = await getSpotifyAccessToken()
    res = await fetch(url, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
    })
  }
  return res
}
