import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSurveyRequestSchema, type SurveyRow } from '@/lib/api/schemas';
import { unauthorized, badRequest, internal } from '@/lib/api/errors';
import { DEFAULT_SETTINGS } from '@/types/survey';
import { log } from '@/lib/log';

/**
 * POST /api/surveys
 * Creates a draft survey owned by the authenticated user.
 * Body: { title?: string, description?: string } — both optional.
 * Returns: 201 with the created SurveyRow.
 *
 * This route is the API contract seam the frontend dashboard depends on.
 * Frontend redesigns can change the dashboard UI freely; as long as they
 * still POST here with the same shape, persistence keeps working.
 */
export async function POST(req: NextRequest) {
  const start = Date.now();

  let body: unknown;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const parsed = createSurveyRequestSchema.safeParse(body);
  if (!parsed.success) {
    log.warn({ event: 'surveys.create_invalid_body', durationMs: Date.now() - start });
    return badRequest(parsed.error);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return unauthorized();
  }

  const { data, error } = await supabase
    .from('surveys')
    .insert({
      user_id: user.id,
      title: parsed.data.title ?? 'Untitled Survey',
      description: parsed.data.description ?? '',
      schema: [],
      settings: DEFAULT_SETTINGS,
    })
    .select()
    .single();

  if (error || !data) {
    log.error({
      event: 'surveys.create_failed',
      userId: user.id,
      error: error?.message,
      durationMs: Date.now() - start,
    });
    return internal('Failed to create survey');
  }

  log.info({
    event: 'surveys.created',
    userId: user.id,
    surveyId: data.id,
    durationMs: Date.now() - start,
  });

  return NextResponse.json<SurveyRow>(data, { status: 201 });
}
