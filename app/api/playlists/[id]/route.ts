import { createClient } from "@/lib/supabase"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = createClient()

  const { data, error } = await supabase
    .from("playlists")
    .select(
      "id, name, description, created_at, card_style, template_front_path, template_back_path"
    )
    .eq("id", id)
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return Response.json({ error: "not_found" }, { status: 404 })
  }

  return Response.json({ playlist: data })
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const body = await req.json()

  const patch: Record<string, unknown> = {}

  if (typeof body.name === "string") {
    const name = body.name.trim()
    if (!name || name.length > 60) {
      return Response.json({ error: "Niepoprawna nazwa" }, { status: 400 })
    }
    patch.name = name
  }

  if (body.description !== undefined) {
    if (body.description === null) {
      patch.description = null
    } else if (typeof body.description === "string") {
      const desc = body.description.trim()
      if (desc.length > 200) {
        return Response.json({ error: "Opis za długi" }, { status: 400 })
      }
      patch.description = desc || null
    }
  }

  if (body.cardStyle !== undefined) {
    if (body.cardStyle === null || typeof body.cardStyle === "object") {
      patch.card_style = body.cardStyle
    }
  }

  if (body.templateFrontPath !== undefined) {
    patch.template_front_path =
      typeof body.templateFrontPath === "string" ? body.templateFrontPath : null
  }

  if (body.templateBackPath !== undefined) {
    patch.template_back_path =
      typeof body.templateBackPath === "string" ? body.templateBackPath : null
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Nic do zaktualizowania" }, { status: 400 })
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from("playlists")
    .update(patch)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ playlist: data })
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = createClient()

  const { error } = await supabase.from("playlists").delete().eq("id", id)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
