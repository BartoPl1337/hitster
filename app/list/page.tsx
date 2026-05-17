import { createClient } from "@/lib/supabase"
import { SongListClient, type Song } from "@/components/song-list-client"

export const revalidate = 0

export default async function ListPage() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("songs")
    .select("*")
    .order("added_at", { ascending: false })

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-destructive">
          Błąd podczas ładowania listy. Sprawdź konfigurację Supabase.
        </p>
      </main>
    )
  }

  return <SongListClient songs={(data ?? []) as Song[]} />
}
