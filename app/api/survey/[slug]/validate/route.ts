import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const { password } = await request.json()

    const supabase = createServiceClient()
    const { data: participant, error } = await supabase
      .from("participants")
      .select("id, first_name, last_name, survey_completed")
      .eq("slug", slug)
      .single()

    if (error || !participant) {
      return NextResponse.json(
        { error: "Survey not found" },
        { status: 404 },
      )
    }

    if (participant.survey_completed) {
      return NextResponse.json(
        { error: "Survey already completed" },
        { status: 403 },
      )
    }

    // Verify password
    const { data: fullParticipant } = await supabase
      .from("participants")
      .select("password")
      .eq("slug", slug)
      .single()

    if (fullParticipant?.password !== password) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 },
      )
    }

    return NextResponse.json({
      valid: true,
      participant: {
        id: participant.id,
        first_name: participant.first_name,
        last_name: participant.last_name,
      },
    })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
