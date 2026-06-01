import { createClient } from "@/lib/supabase"
import { PlaylistsClient, type Playlist } from "@/components/playlists-client"

export const revalidate = 0

export default async function ListsPage() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("playlists")
    .select("id, name, description, created_at, songs(count)")
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[lists] Supabase error:", error)
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="mb-2 text-destructive">Błąd podczas ładowania list.</p>
        <pre className="overflow-x-auto rounded border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {error.message}
          {error.details ? `\n\n${error.details}` : ""}
          {error.hint ? `\n\nHint: ${error.hint}` : ""}
        </pre>
        <p className="mt-3 text-xs text-muted-foreground">
          Jeżeli widzisz {`„relation "playlists" does not exist"`} — musisz uruchomić migrację SQL w Supabase (patrz instrukcja).
        </p>
      </main>
    )
  }

  const playlists: Playlist[] = (data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    description: (p.description as string | null) ?? null,
    created_at: p.created_at as string,
    songCount: Array.isArray(p.songs) ? (p.songs[0]?.count ?? 0) : 0,
  }))

  return <PlaylistsClient initialPlaylists={playlists} />
}
