import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { log } from '@/lib/log';

/**
 * POST /api/surveys/[id]/submit
 * Accepts a respondent's answers for a published survey.
 *
 * Public endpoint (no login required). Uses the anon client so the
 * "Insert to published surveys" RLS policy enforces published-only access
 * — this avoids needing the service-role key in the runtime env for the
 * basic respondent flow.
 *
 * Service-role is only used for the optional guest-token branch (which
 * updates the guests table — that table's RLS only allows the survey
 * owner to write). If service-role isn't configured, the guest-token
 * branch is skipped silently.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now();
  const { id } = await params;

  let body: { answers?: unknown; guestToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { answers, guestToken } = body;

  if (!answers || typeof answers !== 'object') {
    return NextResponse.json(
      { error: 'Missing or invalid answers field' },
      { status: 422 }
    );
  }

  // Anon client; relies on RLS "Insert to published surveys" policy.
  const supabase = await createClient();

  // Insert the response. RLS will reject if survey isn't published.
  const { data: response, error: insertError } = await supabase
    .from('responses')
    .insert({
      survey_id: id,
      answers,
      channel: 'web_form',
      metadata: {
        userAgent: req.headers.get('user-agent') ?? null,
        submittedAt: new Date().toISOString(),
      },
    })
    .select('id')
    .single();

  if (insertError || !response) {
    // Distinguish RLS rejection (likely not-published) from other failures
    const isRls =
      insertError?.code === '42501' ||
      insertError?.message?.toLowerCase().includes('row-level security') ||
      insertError?.message?.toLowerCase().includes('policy');

    log.warn({
      event: 'response.submit_failed',
      surveyId: id,
      reason: isRls ? 'rls_denied_not_published' : 'insert_failed',
      error: insertError?.message,
      durationMs: Date.now() - start,
    });

    return NextResponse.json(
      { error: isRls ? 'Survey not found or not published' : 'Failed to submit response' },
      { status: isRls ? 404 : 500 }
    );
  }

  // Optional guest-token branch: link this response to a pre-invited guest.
  // Requires service-role since guests table RLS restricts writes to the owner.
  if (guestToken) {
    try {
      const service = createServiceClient();
      const { data: guest } = await service
        .from('guests')
        .select('id, name')
        .eq('survey_id', id)
        .eq('token', guestToken)
        .single();

      if (guest) {
        await service
          .from('guests')
          .update({
            status: 'completed',
            response_id: response.id,
            profile: {
              name: guest.name,
              answers,
              completed: true,
              generatedAt: new Date().toISOString(),
            },
          })
          .eq('id', guest.id);
      }
    } catch (e) {
      // Guest update is best-effort. Don't fail the response submission.
      log.warn({
        event: 'response.guest_link_failed',
        surveyId: id,
        responseId: response.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  log.info({
    event: 'response.submitted',
    surveyId: id,
    responseId: response.id,
    hasGuestToken: !!guestToken,
    durationMs: Date.now() - start,
  });

  return NextResponse.json({ success: true, responseId: response.id });
}
