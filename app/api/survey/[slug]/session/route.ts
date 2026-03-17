import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase = createServiceClient()

  const { data: participant, error: pError } = await supabase
    .from("guest_profiles")
    .select("id, first_name, last_name")
    .eq("slug", slug)
    .single()

  if (pError || !participant) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 })
  }

  const { data: questions, error: qError } = await supabase
    .from("questions")
    .select("id, text")
    .eq("is_active", true)
    .order("created_at", { ascending: true })

  if (qError) {
    return NextResponse.json({ error: qError.message }, { status: 500 })
  }

  return NextResponse.json({ participant, questions })
}
