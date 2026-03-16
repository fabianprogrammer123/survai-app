import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { text } = await request.json()
    if (!text?.trim()) {
      return NextResponse.json(
        { error: "Question text is required" },
        { status: 400 },
      )
    }

    const supabase = createServiceClient()

    // Deactivate old question
    const { error: deactivateError } = await supabase
      .from("questions")
      .update({ is_active: false })
      .eq("id", id)

    if (deactivateError) {
      return NextResponse.json(
        { error: deactivateError.message },
        { status: 500 },
      )
    }

    // Create new question row referencing the old one
    const { data, error } = await supabase
      .from("questions")
      .insert({
        text: text.trim(),
        previous_question_id: id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .from("questions")
    .update({ is_active: false })
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
