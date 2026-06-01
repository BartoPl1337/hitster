import Link from "next/link"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase"
import {
  CardPreviewClient,
  type PreviewSong,
} from "@/components/card-preview-client"
import { Card, CardContent } from "@/components/ui/card"
import { ListMusic } from "lucide-react"

export const revalidate = 0

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ playlist?: string; song?: string }>
}) {
  const { playlist: playlistId } = await searchParams
  const supabase = createClient()

  if (!playlistId) {
    const { data, error } = await supabase
      .from("playlists")
      .select("id, name, songs(count)")
      .order("created_at", { ascending: true })

    if (error) {
      return (
        <main className="mx-auto max-w-5xl px-4 py-10">
          <p className="text-destructive">
            Błąd podczas ładowania list. Sprawdź konfigurację Supabase.
          </p>
        </main>
      )
    }

    const playlists = (data ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      songCount: Array.isArray(p.songs) ? (p.songs[0]?.count ?? 0) : 0,
    }))

    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="mb-1 text-2xl font-bold">Podgląd karty</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Wybierz listę, dla której chcesz podejrzeć karty.
        </p>

        {playlists.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            Brak list — utwórz pierwszą w sekcji{" "}
            <Link href="/lists" className="underline">
              Listy
            </Link>
            .
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {playlists.map((p) => (
              <Link
                key={p.id}
                href={`/preview?playlist=${p.id}`}
                className="block focus:outline-none"
              >
                <Card className="transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <ListMusic className="size-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.songCount}{" "}
                        {p.songCount === 1
                          ? "piosenka"
                          : p.songCount < 5 && p.songCount !== 0
                            ? "piosenki"
                            : "piosenek"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    )
  }

  // Sortujemy po added_at ASC — ta sama kolejność, której używa generator PDF
  // do numerowania kart, więc numery w podglądzie zgadzają się z PDF-em.
  const [{ data: playlist }, { data: songs, error: songsErr }] = await Promise.all([
    supabase
      .from("playlists")
      .select("id, name, card_style, template_front_path, template_back_path")
      .eq("id", playlistId)
      .maybeSingle(),
    supabase
      .from("songs")
      .select("*")
      .eq("playlist_id", playlistId)
      .order("added_at", { ascending: true }),
  ])

  if (songsErr) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-destructive">
          Błąd podczas ładowania piosenek. Sprawdź konfigurację Supabase.
        </p>
      </main>
    )
  }

  if (!playlist) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-muted-foreground">
          Nie znaleziono listy.{" "}
          <Link href="/preview" className="underline">
            Wybierz inną
          </Link>
          .
        </p>
      </main>
    )
  }

  const frontPath = (playlist.template_front_path as string | null) ?? null
  const backPath = (playlist.template_back_path as string | null) ?? null

  const templateFrontUrl = frontPath
    ? supabase.storage.from("card-templates").getPublicUrl(frontPath).data.publicUrl
    : null
  const templateBackUrl = backPath
    ? supabase.storage.from("card-templates").getPublicUrl(backPath).data.publicUrl
    : null

  return (
    <Suspense>
      <CardPreviewClient
        songs={(songs ?? []) as PreviewSong[]}
        playlistName={playlist.name as string}
        playlistId={playlist.id as string}
        initialStyle={playlist.card_style ?? null}
        initialTemplateFrontUrl={templateFrontUrl}
        initialTemplateBackUrl={templateBackUrl}
      />
    </Suspense>
  )
}
