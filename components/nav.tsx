"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Music2 } from "lucide-react"

export function Nav() {
  const pathname = usePathname()

  const isListsActive = pathname === "/lists" || pathname.startsWith("/lists/")
  const isPreviewActive = pathname === "/preview"

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/lists" className="flex items-center gap-2 text-base font-bold">
          <Music2 className="size-5 text-primary" />
          Hitster Song Collector
        </Link>
        <nav className="flex gap-1">
          <Link
            href="/lists"
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isListsActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Listy
          </Link>
          <Link
            href="/preview"
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isPreviewActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Podgląd karty
          </Link>
        </nav>
      </div>
    </header>
  )
}
