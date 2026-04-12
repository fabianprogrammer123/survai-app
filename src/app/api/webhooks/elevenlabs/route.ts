import { NextRequest, NextResponse } from 'next/server';
import { dataCollectionToAnswers } from '@/lib/elevenlabs/agent-builder';
import { createServiceClient } from '@/lib/supabase/server';
import type { WebhookTranscriptionPayload } from '@/lib/elevenlabs/types';

/**
 * POST /api/webhooks/elevenlabs
 * Receives post-call webhooks from ElevenLabs after a conversation ends.
 * Works for both phone calls and web-based voice interviews.
 *
 * After saving the response, attempts to link it to a guest record
 * and generate a short profile summary.
 */

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as WebhookTranscriptionPayload;

    console.log(`[ElevenLabs Webhook] type=${payload.type} conversation=${payload.data?.conversation_id}`);

    if (payload.type === 'post_call_transcription') {
      const { data } = payload;

      // Extract survey answers from data collection results
      const answers = data.analysis?.data_collection_results
        ? dataCollectionToAnswers(data.analysis.data_collection_results)
        : {};

      // Extract metadata fields
      const sentiment = data.analysis?.data_collection_results?.respondent_sentiment?.value;
      const additionalContext = data.analysis?.data_collection_results?.additional_context?.value;
      const surveyCompleted = data.analysis?.data_collection_results?.survey_completed?.value ?? false;

      const metadata = {
        conversationId: data.conversation_id,
        phoneNumber: data.metadata?.to_number,
        callDuration: data.metadata?.call_duration_secs,
        startTime: data.metadata?.start_time_unix,
        endTime: data.metadata?.end_time_unix,
        transcript: data.transcript,
        evaluation: data.analysis?.evaluation_results,
        sentiment,
        additionalContext,
        surveyCompleted,
        channel: data.metadata?.to_number ? 'phone_call' : 'web_voice',
      };

      const channel = data.metadata?.to_number ? 'phone_call' : 'web_voice';

      console.log(
        `[ElevenLabs Webhook] Captured ${Object.keys(answers).length} answers (${channel}) from conversation ${data.conversation_id}`
      );

      try {
        const supabase = createServiceClient();

        // Find the survey that owns this agent
        const { data: survey, error: lookupError } = await supabase
          .from('surveys')
          .select('id')
          .eq('agent_id', data.agent_id)
          .single();

        if (lookupError || !survey) {
          console.error(`[ElevenLabs Webhook] No survey for agent_id=${data.agent_id}:`, lookupError);
          return NextResponse.json({ error: 'Survey not found' }, { status: 500 });
        }

        // Insert response
        const { data: response, error: insertError } = await supabase
          .from('responses')
          .insert({
            survey_id: survey.id,
            answers,
            channel,
            metadata,
          })
          .select('id')
          .single();

        if (insertError || !response) {
          console.error('[ElevenLabs Webhook] Insert error:', insertError);
          return NextResponse.json({ error: 'Response insert failed' }, { status: 500 });
        }

        console.log(`[ElevenLabs Webhook] Response ${response.id} saved to survey ${survey.id}`);

        // Try to link to a guest and generate profile
        await linkResponseToGuest(supabase, survey.id, response.id, data, answers, metadata);
      } catch (dbErr) {
        console.warn('[ElevenLabs Webhook] DB persistence skipped:', dbErr);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[ElevenLabs Webhook] Error:', error);
    return NextResponse.json({ received: true, error: 'Processing failed' });
  }
}

/**
 * Try to match this response to a guest record.
 * Match by: conversation metadata, or by guest name from data collection.
 * Then generate a short profile summary.
 */
async function linkResponseToGuest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  surveyId: string,
  responseId: string,
  data: WebhookTranscriptionPayload['data'],
  answers: Record<string, unknown>,
  metadata: Record<string, unknown>
) {
  try {
    // Find guests for this survey that haven't completed yet
    const { data: guests } = await supabase
      .from('guests')
      .select('id, name, status')
      .eq('survey_id', surveyId)
      .in('status', ['invited', 'started']);

    if (!guests || guests.length === 0) return;

    // Try to match by name from the conversation
    // The agent greets them by name, so the name should be in the first message
    const firstAgentMsg = data.transcript?.find((t) => t.role === 'agent')?.message || '';
    const matchedGuest = guests.find((g: { name: string }) => {
      const firstName = g.name.split(' ')[0].toLowerCase();
      return firstAgentMsg.toLowerCase().includes(firstName);
    });

    if (!matchedGuest) {
      console.log(`[ElevenLabs Webhook] Could not match conversation to a guest`);
      return;
    }

    // Build a simple profile from the answers
    const profile = buildGuestProfile(matchedGuest.name, answers, metadata);

    // Update guest record
    await supabase
      .from('guests')
      .update({
        status: 'completed',
        response_id: responseId,
        profile,
      })
      .eq('id', matchedGuest.id);

    console.log(`[ElevenLabs Webhook] Linked response to guest "${matchedGuest.name}"`);
  } catch (err) {
    console.warn('[ElevenLabs Webhook] Guest linking failed:', err);
  }
}

/**
 * Generate a simple guest profile from their answers.
 * Runs locally (no API call) — just structures the data.
 */
function buildGuestProfile(
  name: string,
  answers: Record<string, unknown>,
  metadata: Record<string, unknown>
): Record<string, unknown> {
  return {
    name,
    answers,
    sentiment: metadata.sentiment || null,
    additionalContext: metadata.additionalContext || null,
    completed: metadata.surveyCompleted ?? false,
    callDuration: metadata.callDuration || null,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * GET /api/webhooks/elevenlabs?conversationId=xxx&surveyId=xxx
 * Retrieve webhook responses from the database.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const conversationId = req.nextUrl.searchParams.get('conversationId');
    const surveyId = req.nextUrl.searchParams.get('surveyId');

    if (conversationId) {
      const { data } = await supabase
        .from('responses')
        .select('*')
        .filter('metadata->>conversationId', 'eq', conversationId)
        .single();

      return NextResponse.json({ response: data || null });
    }

    if (surveyId) {
      const { data, count } = await supabase
        .from('responses')
        .select('*', { count: 'exact' })
        .eq('survey_id', surveyId)
        .order('submitted_at', { ascending: false });

      return NextResponse.json({ responses: data || [], count: count || 0 });
    }

    return NextResponse.json({ error: 'Provide conversationId or surveyId' }, { status: 400 });
  } catch (error) {
    console.error('[ElevenLabs Webhook GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 });
  }
}
