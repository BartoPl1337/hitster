"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Copy, Check, Music2, Search } from "lucide-react"

export type Song = {
  id: string
  added_by: string
  spotify_track_id: string
  title: string
  artist: string
  album_cover: string | null
  year: number | null
  comment: string | null
  added_at: string
}

export function SongListClient({ songs }: { songs: Song[] }) {
  const [search, setSearch] = useState("")
  const [copied, setCopied] = useState(false)

  const filtered = songs.filter((s) =>
    `${s.title} ${s.artist}`.toLowerCase().includes(search.toLowerCase())
  )

  async function copyList() {
    const text = songs
      .map(
        (s) =>
          `${s.title} - ${s.artist}${s.year ? ` (${s.year})` : ""}`
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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Lista piosenek</h1>
          <p className="text-sm text-muted-foreground">
            {songs.length} {songs.length === 1 ? "piosenka" : songs.length < 5 ? "piosenki" : "piosenek"} na liście
          </p>
        </div>
        <Button variant="outline" onClick={copyList} disabled={songs.length === 0}>
          {copied ? (
            <Check className="mr-2 size-4" />
          ) : (
            <Copy className="mr-2 size-4" />
          )}
          Kopiuj listę
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Szukaj po tytule lub wykonawcy..."
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((song) => (
            <Card key={song.id} className="overflow-hidden">
              {song.album_cover ? (
                <img
                  src={song.album_cover}
                  alt={`${song.title} — okładka`}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-muted">
                  <Music2 className="size-12 text-muted-foreground" />
                </div>
              )}
              <CardContent className="p-3">
                <p className="font-semibold leading-tight">{song.title}</p>
                <p className="text-sm text-muted-foreground">{song.artist}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {song.year && (
                    <Badge variant="secondary">{song.year}</Badge>
                  )}
                  <Badge variant="outline">{song.added_by}</Badge>
                </div>
                {song.comment && (
                  <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                    &ldquo;{song.comment}&rdquo;
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
