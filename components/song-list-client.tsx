"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Copy,
  Check,
  Music2,
  Search,
  Plus,
  ArrowLeft,
  Loader2,
  X,
} from "lucide-react"

export type Song = {
  id: string
  added_by: string
  spotify_track_id: string
  title: string
  artist: string
  album_cover: string | null
  year: number | null
  genres: string[] | null
  comment: string | null
  added_at: string
  playlist_id: string
}

export type PlaylistMeta = {
  id: string
  name: string
  description: string | null
}

export function SongListClient({
  songs,
  playlist,
}: {
  songs: Song[]
  playlist: PlaylistMeta
}) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [copied, setCopied] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importUrl, setImportUrl] = useState("")
  const [importNick, setImportNick] = useState("")
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = localStorage.getItem("hitster_nick") ?? ""
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImportNick(saved)
    }
  }, [])

  const filtered = songs.filter((s) => {
    const haystack = [s.title, s.artist, ...(s.genres ?? [])]
      .join(" ")
      .toLowerCase()
    return haystack.includes(search.toLowerCase())
  })

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    if (!importUrl.trim() || !importNick.trim()) return

    setIsImporting(true)
    try {
      const res = await fetch(`/api/playlists/${playlist.id}/import-spotify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: importUrl.trim(),
          addedBy: importNick.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "Błąd importu")
        return
      }

      const { imported, skipped, total } = data
      if (imported === 0 && skipped > 0) {
        toast.warning(
          `Wszystkie ${skipped} utworów już jest na tej liście — nic nie dodano.`
        )
      } else if (skipped > 0) {
        toast.success(
          `Zaimportowano ${imported} z ${total}. Pominięto ${skipped} duplikatów.`
        )
      } else {
        toast.success(`Zaimportowano ${imported} utworów.`)
      }

      setImportUrl("")
      setShowImport(false)
      router.refresh()
    } catch {
      toast.error("Nie udało się zaimportować")
    } finally {
      setIsImporting(false)
    }
  }

  async function copyList() {
    const text = songs
      .map(
        (s) => `${s.title} - ${s.artist}${s.year ? ` (${s.year})` : ""}`
      )
      .join("\n")

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success("Lista skopiowana do schowka!")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Nie udało się skopiować listy.")
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/lists"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Wszystkie listy
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{playlist.name}</h1>
          {playlist.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {playlist.description}
            </p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {songs.length}{" "}
            {songs.length === 1
              ? "piosenka"
              : songs.length < 5 && songs.length !== 0
                ? "piosenki"
                : "piosenek"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={copyList}
            disabled={songs.length === 0}
          >
            {copied ? (
              <Check className="mr-2 size-4" />
            ) : (
              <Copy className="mr-2 size-4" />
            )}
            Kopiuj
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowImport((v) => !v)}
          >
            <SpotifyMark className="mr-2 size-4" />
            Importuj ze Spotify
          </Button>
          <Button asChild>
            <Link href={`/lists/${playlist.id}/add`}>
              <Plus className="mr-2 size-4" />
              Dodaj piosenkę
            </Link>
          </Button>
        </div>
      </div>

      {showImport && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <form onSubmit={handleImport} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">Importuj ze Spotify</h2>
                  <p className="text-xs text-muted-foreground">
                    Wklej link do publicznej playlisty lub albumu (max 500 utworów).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImport(false)}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Zamknij"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="import-url">
                  URL Spotify
                </label>
                <Input
                  id="import-url"
                  placeholder="https://open.spotify.com/playlist/..."
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  required
                  disabled={isImporting}
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="import-nick">
                  Twoje imię / nick
                </label>
                <Input
                  id="import-nick"
                  placeholder="np. Bartek"
                  value={importNick}
                  onChange={(e) => {
                    setImportNick(e.target.value)
                    localStorage.setItem("hitster_nick", e.target.value)
                  }}
                  required
                  disabled={isImporting}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={
                    !importUrl.trim() || !importNick.trim() || isImporting
                  }
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Importuję...
                    </>
                  ) : (
                    "Importuj"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative mb-6">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Szukaj po tytule, wykonawcy lub gatunku..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          {search
            ? "Brak wyników dla tego wyszukiwania."
            : "Brak piosenek na liście. Bądź pierwszy!"}
        </div>
      ) : (
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((song) => (
            <Link
              key={song.id}
              href={`/preview?song=${song.id}&playlist=${playlist.id}`}
              className="group flex focus:outline-none"
              title="Podgląd karty"
            >
              <Card className="flex h-full w-full flex-col overflow-hidden transition-shadow group-hover:shadow-lg group-focus-visible:ring-2 group-focus-visible:ring-ring">
                {song.album_cover ? (
                  <img
                    src={song.album_cover}
                    alt={`${song.title} — okładka`}
                    className="aspect-square w-full shrink-0 object-cover transition-transform group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex aspect-square w-full shrink-0 items-center justify-center bg-muted">
                    <Music2 className="size-12 text-muted-foreground" />
                  </div>
                )}
                <CardContent className="flex flex-1 flex-col p-3">
                  <p
                    className="line-clamp-2 font-semibold leading-tight"
                    title={song.title}
                  >
                    {song.title}
                  </p>
                  <p
                    className="truncate text-sm text-muted-foreground"
                    title={song.artist}
                  >
                    {song.artist}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {song.year && <Badge variant="secondary">{song.year}</Badge>}
                    <Badge variant="outline">{song.added_by}</Badge>
                  </div>
                  {song.genres && song.genres.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {song.genres.map((g) => (
                        <Badge
                          key={g}
                          variant="default"
                          className="text-[10px] font-normal"
                        >
                          {g}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}

function SpotifyMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0Zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02Zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2Zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3Z" />
    </svg>
  )
}
