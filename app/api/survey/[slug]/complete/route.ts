import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const { transcript, answers, conversation_id } = await request.json()

    const supabase = createServiceClient()

    const { data: participant, error: pError } = await supabase
      .from("participants")
      .select("id, survey_completed")
      .eq("slug", slug)
      .single()

    if (pError || !participant) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 },
      )
    }

    if (participant.survey_completed) {
      return NextResponse.json(
        { error: "Survey already completed" },
        { status: 403 },
      )
    }

    // Create response
    const { data: response, error: rError } = await supabase
      .from("responses")
      .insert({
        participant_id: participant.id,
        transcript: transcript ?? "",
        conversation_id: conversation_id ?? null,
      })
      .select()
      .single()

    if (rError) {
      return NextResponse.json({ error: rError.message }, { status: 500 })
    }

    // Insert answers
    if (answers && Object.keys(answers).length > 0) {
      const answerRows = Object.entries(answers).map(
        ([question_id, answer_text]) => ({
          response_id: response.id,
          question_id,
          answer_text: String(answer_text),
        }),
      )

      const { error: aError } = await supabase
        .from("response_answers")
        .insert(answerRows)

      if (aError) {
        console.error("Failed to insert answers:", aError)
      }
    }

    // Mark participant as completed
    await supabase
      .from("participants")
      .update({ survey_completed: true })
      .eq("id", participant.id)

    return NextResponse.json({ success: true, responseId: response.id })
  } catch (error) {
    console.error("Failed to complete survey:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
