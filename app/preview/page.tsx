import { Suspense } from "react"
import { createClient } from "@/lib/supabase"
import {
  CardPreviewClient,
  type PreviewSong,
} from "@/components/card-preview-client"

export const revalidate = 0

export default async function PreviewPage() {
  const supabase = createClient()

  // Sortujemy po added_at ASC — to ta sama kolejność, której używa
  // generate.js do numerowania kart (001, 002, ...), więc numery
  // w podglądzie zgadzają się z numerami w finalnym PDF-ie.
  const { data, error } = await supabase
    .from("songs")
    .select("*")
    .order("added_at", { ascending: true })

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-destructive">
          Błąd podczas ładowania piosenek. Sprawdź konfigurację Supabase.
        </p>
      </main>
    )
  }

  const songs = (data ?? []) as PreviewSong[]

  return (
    <Suspense>
      <CardPreviewClient songs={songs} />
    </Suspense>
  )
}
