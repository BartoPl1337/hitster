import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { SongListClient, type Song } from "@/components/song-list-client"

export const revalidate = 0

export default async function PlaylistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createClient()

  const [{ data: playlist, error: playlistErr }, { data: songs, error: songsErr }] =
    await Promise.all([
      supabase
        .from("playlists")
        .select("id, name, description")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("songs")
        .select("*")
        .eq("playlist_id", id)
        .order("added_at", { ascending: false }),
    ])

  if (playlistErr || songsErr) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-destructive">
          Błąd podczas ładowania listy. Sprawdź konfigurację Supabase.
        </p>
      </main>
    )
  }

  if (!playlist) {
    notFound()
  }

  return (
    <SongListClient
      playlist={{
        id: playlist.id as string,
        name: playlist.name as string,
        description: (playlist.description as string | null) ?? null,
      }}
      songs={(songs ?? []) as Song[]}
    />
  )
}
