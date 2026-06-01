import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { AddSongClient } from "@/components/add-song-client"

export const revalidate = 0

export default async function AddSongPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createClient()

  const { data: playlist, error } = await supabase
    .from("playlists")
    .select("id, name")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
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
    <AddSongClient
      playlistId={playlist.id as string}
      playlistName={playlist.name as string}
    />
  )
}
