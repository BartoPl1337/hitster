"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, ListMusic, Trash2, X, Loader2 } from "lucide-react"

export type Playlist = {
  id: string
  name: string
  description: string | null
  created_at: string
  songCount: number
}

export function PlaylistsClient({
  initialPlaylists,
}: {
  initialPlaylists: Playlist[]
}) {
  const router = useRouter()
  const [playlists, setPlaylists] = useState(initialPlaylists)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (res.status === 409) {
        toast.error("Lista o tej nazwie już istnieje")
        return
      }

      if (!res.ok) {
        toast.error(data.error ?? "Nie udało się utworzyć listy")
        return
      }

      toast.success(`Utworzono listę „${data.playlist.name}"`)
      setPlaylists((prev) => [
        ...prev,
        {
          id: data.playlist.id,
          name: data.playlist.name,
          description: data.playlist.description,
          created_at: data.playlist.created_at,
          songCount: 0,
        },
      ])
      setName("")
      setDescription("")
      setShowForm(false)
    } catch {
      toast.error("Wystąpił błąd")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(playlist: Playlist) {
    const confirmMsg =
      playlist.songCount > 0
        ? `Usunąć listę „${playlist.name}" wraz z ${playlist.songCount} piosenkami?`
        : `Usunąć listę „${playlist.name}"?`

    if (!confirm(confirmMsg)) return

    setDeletingId(playlist.id)
    try {
      const res = await fetch(`/api/playlists/${playlist.id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        toast.error("Nie udało się usunąć listy")
        return
      }

      setPlaylists((prev) => prev.filter((p) => p.id !== playlist.id))
      toast.success("Lista usunięta")
      router.refresh()
    } catch {
      toast.error("Wystąpił błąd")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Listy piosenek</h1>
          <p className="text-sm text-muted-foreground">
            {playlists.length === 0
              ? "Brak list — utwórz pierwszą"
              : `${playlists.length} ${playlists.length === 1 ? "lista" : playlists.length < 5 ? "listy" : "list"}`}
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 size-4" />
            Nowa lista
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold">Nowa lista</h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setName("")
                    setDescription("")
                  }}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Zamknij"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="playlist-name">
                  Nazwa
                </label>
                <Input
                  id="playlist-name"
                  placeholder="np. Impreza urodzinowa 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 60))}
                  maxLength={60}
                  required
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="playlist-desc">
                  Opis{" "}
                  <span className="font-normal text-muted-foreground">
                    (opcjonalny)
                  </span>
                </label>
                <Textarea
                  id="playlist-desc"
                  placeholder="Krótko o czym jest ta lista"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 200))}
                  maxLength={200}
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={!name.trim() || isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Tworzenie...
                    </>
                  ) : (
                    "Utwórz listę"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {playlists.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          Stwórz pierwszą listę, aby zacząć dodawać piosenki.
        </div>
      ) : (
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((playlist) => (
            <div key={playlist.id} className="relative flex">
              <Link
                href={`/lists/${playlist.id}`}
                className="flex w-full focus:outline-none"
              >
                <Card className="flex h-full w-full flex-col transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring">
                  <CardContent className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <ListMusic className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1 pr-8">
                        <p className="truncate font-semibold" title={playlist.name}>
                          {playlist.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {playlist.songCount}{" "}
                          {playlist.songCount === 1
                            ? "piosenka"
                            : playlist.songCount < 5 && playlist.songCount !== 0
                              ? "piosenki"
                              : "piosenek"}
                        </p>
                      </div>
                    </div>
                    <p
                      className="line-clamp-2 min-h-[2.5em] text-sm text-muted-foreground"
                      title={playlist.description ?? ""}
                    >
                      {playlist.description ?? (
                        <span className="italic opacity-60">Brak opisu</span>
                      )}
                    </p>
                  </CardContent>
                </Card>
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(playlist)}
                disabled={deletingId === playlist.id}
                className="absolute right-3 top-3 rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                aria-label={`Usuń listę ${playlist.name}`}
                title="Usuń listę"
              >
                {deletingId === playlist.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
