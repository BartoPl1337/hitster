import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    throw new Error(
      `Brak zmiennych Supabase w .env.local. url=${url ?? "brak"}, key=${key ? "ok" : "brak"}`
    )
  }

  return createSupabaseClient(url, key)
}
