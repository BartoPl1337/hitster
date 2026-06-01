"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, X, Music2, Loader2, ArrowLeft } from "lucide-react"
import { GenrePicker } from "@/components/genre-picker"

type SpotifyTrack = {
  id: string
  title: string
  artist: string
  year: number | null
  albumCover: string | null
  spotifyGenres: string[]
}

export function AddSongClient({
  playlistId,
  playlistName,
}: {
  playlistId: string
  playlistName: string
}) {
  const router = useRouter()
  const [nick, setNick] = useState(() => {
    if (typeof window === "undefined") return ""
    return localStorage.getItem("hitster_nick") ?? ""
  })
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [tracks, setTracks] = useState<SpotifyTrack[]>([])
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null)
  const [genres, setGenres] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let cancelled = false
    if (debouncedQuery.length < 2) {
      queueMicrotask(() => {
        if (cancelled) return
        setTracks([])
        setShowDropdown(false)
      })
      return () => {
        cancelled = true
      }
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSearching(true)
    fetch(`/api/spotify/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(async (res) => {
        const data = await res.json()
        if (res.status === 429) {
          const wait = data.retryAfter ?? 10
          toast.error(`Zbyt wiele zapytań — poczekaj ${wait} sekund i spróbuj ponownie`)
          setTracks([])
          setShowDropdown(false)
          return
        }
        setTracks(data.tracks ?? [])
        setShowDropdown(true)
      })
      .catch(() => toast.error("Błąd podczas wyszukiwania"))
      .finally(() => setIsSearching(false))
  }, [debouncedQuery])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleSelectTrack(track: SpotifyTrack) {
    setSelectedTrack(track)
    setQuery("")
    setTracks([])
    setShowDropdown(false)
  }

  function clearSelection() {
    setSelectedTrack(null)
    setQuery("")
    setGenres([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nick.trim() || !selectedTrack) return

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addedBy: nick.trim(),
          playlistId,
          spotifyTrackId: selectedTrack.id,
          title: selectedTrack.title,
          artist: selectedTrack.artist,
          albumCover: selectedTrack.albumCover,
          year: selectedTrack.year,
          genres,
        }),
      })

      if (res.status === 409) {
        toast.error("Ta piosenka już jest na tej liście!")
        return
      }

      if (!res.ok) {
        toast.error("Wystąpił błąd. Spróbuj ponownie.")
        return
      }

      toast.success(`Dodano "${selectedTrack.title}"`)
      setSelectedTrack(null)
      setGenres([])
      router.refresh()
    } catch {
      toast.error("Wystąpił błąd. Spróbuj ponownie.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <Link
        href={`/lists/${playlistId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Wróć do listy
      </Link>
      <h1 className="mb-1 text-2xl font-bold">Dodaj piosenkę</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Dodajesz do listy{" "}
        <span className="font-medium text-foreground">&bdquo;{playlistName}&rdquo;</span>.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="nick">
            Twoje imię / nick
          </label>
          <Input
            id="nick"
            placeholder="np. Bartek"
            value={nick}
            onChange={(e) => {
              setNick(e.target.value)
              localStorage.setItem("hitster_nick", e.target.value)
            }}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Piosenka</label>

          {selectedTrack ? (
            <Card className="overflow-hidden">
              <CardContent className="flex gap-4 p-4">
                {selectedTrack.albumCover ? (
                  <img
                    src={selectedTrack.albumCover}
                    alt={selectedTrack.title}
                    className="size-20 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Music2 className="size-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                  <p className="truncate font-semibold">{selectedTrack.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {selectedTrack.artist}
                  </p>
                  {selectedTrack.year && (
                    <Badge variant="secondary" className="w-fit">
                      {selectedTrack.year}
                    </Badge>
                  )}
                </div>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="shrink-0 self-start rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Usuń wybór"
                >
                  <X className="size-4" />
                </button>
              </CardContent>
            </Card>
          ) : (
            <div ref={containerRef} className="relative">
              <div className="relative">
                {isSearching ? (
                  <Loader2 className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                ) : (
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                )}
                <Input
                  className="pl-8"
                  placeholder="Szukaj piosenki... (min. 2 znaki)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => tracks.length > 0 && setShowDropdown(true)}
                  autoComplete="off"
                />
              </div>

              {showDropdown && (
                <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
                  {tracks.length === 0 ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      Brak wyników
                    </div>
                  ) : (
                    <ul>
                      {tracks.map((track, i) => (
                        <li
                          key={track.id}
                          className={
                            i < tracks.length - 1
                              ? "border-b border-border"
                              : ""
                          }
                        >
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted"
                            onClick={() => handleSelectTrack(track)}
                          >
                            {track.albumCover ? (
                              <img
                                src={track.albumCover}
                                alt={track.title}
                                className="size-10 shrink-0 rounded object-cover"
                              />
                            ) : (
                              <div className="flex size-10 shrink-0 items-center justify-center rounded bg-muted">
                                <Music2 className="size-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {track.title}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {track.artist}
                                {track.year ? ` · ${track.year}` : ""}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            Gatunek{" "}
            <span className="font-normal text-muted-foreground">
              (opcjonalny, max 5)
            </span>
          </label>
          <GenrePicker
            value={genres}
            onChange={setGenres}
            suggestions={selectedTrack?.spotifyGenres ?? []}
          />
          <p className="text-xs text-muted-foreground">
            {selectedTrack && (selectedTrack.spotifyGenres?.length ?? 0) > 0
              ? "Sugestie ze Spotify pojawią się na górze listy."
              : "Wybierz piosenkę, by zobaczyć sugestie Spotify, lub wybierz z listy."}
          </p>
        </div>

        <Button
          type="submit"
          disabled={!nick.trim() || !selectedTrack || isSubmitting}
          size="lg"
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Dodawanie...
            </>
          ) : (
            "Dodaj piosenkę"
          )}
        </Button>
      </form>
    </main>
  )
}
