import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { nanoid } from "nanoid"

// nanoid is still used for slug generation

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("guest_profiles")
    .select("*, responses(id, created_at)")
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  try {
    const { first_name, last_name } = await request.json()
    if (!first_name?.trim() || !last_name?.trim()) {
      return NextResponse.json(
        { error: "First name and last name are required" },
        { status: 400 },
      )
    }

    const slug = nanoid(10)

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("guest_profiles")
      .insert({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        slug,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
