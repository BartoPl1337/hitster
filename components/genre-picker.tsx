"use client"

import { useEffect, useRef, useState } from "react"
import { Plus, X, ChevronDown, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export const CURATED_GENRES = [
  "Pop",
  "Rock",
  "Polski rock",
  "Hip-hop",
  "Rap",
  "Polski rap",
  "Disco",
  "Disco polo",
  "Elektronika",
  "Dance",
  "House",
  "Techno",
  "R&B",
  "Soul",
  "Funk",
  "Jazz",
  "Blues",
  "Metal",
  "Punk",
  "Indie",
  "Alternative",
  "Reggae",
  "Country",
  "Folk",
  "Klasyczna",
  "Filmowa",
  "Synth-pop",
  "Latin",
  "K-pop",
  "Polska piosenka",
] as const

function normalize(s: string) {
  return s.trim().toLowerCase()
}

type Props = {
  value: string[]
  onChange: (genres: string[]) => void
  suggestions?: string[]
  max?: number
}

export function GenrePicker({ value, onChange, suggestions = [], max = 5 }: Props) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectedSet = new Set(value.map(normalize))
  const limitReached = value.length >= max

  function addGenre(genre: string) {
    const trimmed = genre.trim()
    if (!trimmed) return
    if (selectedSet.has(normalize(trimmed))) return
    if (limitReached) return
    onChange([...value, trimmed])
    setQuery("")
  }

  function removeGenre(genre: string) {
    onChange(value.filter((g) => g !== genre))
  }

  const q = normalize(query)

  const visibleSuggestions = suggestions
    .filter((g) => g && !selectedSet.has(normalize(g)))
    .filter((g) => (q ? normalize(g).includes(q) : true))
    .slice(0, 6)

  const visibleCurated = CURATED_GENRES.filter(
    (g) => !selectedSet.has(normalize(g))
  ).filter((g) => (q ? normalize(g).includes(q) : true))

  const hasExactMatch =
    !!q &&
    (CURATED_GENRES.some((g) => normalize(g) === q) ||
      suggestions.some((g) => normalize(g) === q) ||
      selectedSet.has(q))

  const canAddCustom = !!q && !hasExactMatch && !limitReached

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      if (visibleCurated.length > 0) {
        addGenre(visibleCurated[0])
      } else if (visibleSuggestions.length > 0) {
        addGenre(visibleSuggestions[0])
      } else if (canAddCustom) {
        addGenre(query)
      }
    } else if (e.key === "Backspace" && !query && value.length > 0) {
      removeGenre(value[value.length - 1])
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
        onClick={() => setOpen(true)}
      >
        {value.map((genre) => (
          <Badge
            key={genre}
            variant="secondary"
            className="gap-1 pr-1"
          >
            {genre}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                removeGenre(genre)
              }}
              className="rounded-full p-0.5 transition-colors hover:bg-muted-foreground/20"
              aria-label={`Usuń ${genre}`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <input
          className="flex-1 min-w-[8rem] bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={
            value.length === 0
              ? "Wybierz lub wpisz gatunek..."
              : limitReached
                ? `Maks. ${max} gatunków`
                : "Dodaj kolejny..."
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={limitReached && !query}
        />
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
          <div className="max-h-72 overflow-y-auto py-1">
            {visibleSuggestions.length > 0 && (
              <div className="mb-1">
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="size-3" />
                  Sugerowane ze Spotify
                </div>
                {visibleSuggestions.map((g) => (
                  <button
                    key={`s-${g}`}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                    onClick={() => addGenre(g)}
                  >
                    <span>{g}</span>
                    <Plus className="size-3.5 text-muted-foreground" />
                  </button>
                ))}
                <div className="my-1 border-t border-border" />
              </div>
            )}

            {visibleCurated.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Gatunki
                </div>
                {visibleCurated.map((g) => (
                  <button
                    key={`c-${g}`}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                    onClick={() => addGenre(g)}
                  >
                    <span>{g}</span>
                    <Plus className="size-3.5 text-muted-foreground" />
                  </button>
                ))}
              </>
            )}

            {canAddCustom && (
              <>
                {(visibleSuggestions.length > 0 || visibleCurated.length > 0) && (
                  <div className="my-1 border-t border-border" />
                )}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                  onClick={() => addGenre(query)}
                >
                  <Plus className="size-3.5" />
                  <span>
                    Dodaj „<span className="font-medium">{query.trim()}</span>&rdquo;
                  </span>
                </button>
              </>
            )}

            {visibleSuggestions.length === 0 &&
              visibleCurated.length === 0 &&
              !canAddCustom && (
                <div className="px-3 py-3 text-center text-sm text-muted-foreground">
                  {limitReached
                    ? `Osiągnięto limit ${max} gatunków`
                    : "Brak wyników"}
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  )
}
