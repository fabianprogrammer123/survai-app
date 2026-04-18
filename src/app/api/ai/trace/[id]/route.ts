import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/ai/trace/[id]
 * Returns a single ai_traces row for the AI Inspector drawer.
 *
 * Access rules:
 * - Anonymous traces (survey_id IS NULL, emitted by the /test flow) are
 *   readable by anyone who holds the trace uuid. UUIDs are unguessable
 *   and these rows contain no PII beyond the creator's own prompt, so
 *   information disclosure is negligible.
 * - Survey-linked traces are readable only by the survey owner.
 *
 * Uses the service-role client to bypass RLS (which only exposes INSERT
 * to anon) and enforces the above rules in code.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing trace id' }, { status: 400 });
  }

  try {
    const service = createServiceClient();
    const { data: trace, error } = await service
      .from('ai_traces')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !trace) {
      return NextResponse.json({ error: 'Trace not found' }, { status: 404 });
    }

    if (trace.survey_id === null) {
      return NextResponse.json({ trace });
    }

    const authed = await createClient();
    const { data: { user } } = await authed.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: survey } = await service
      .from('surveys')
      .select('user_id')
      .eq('id', trace.survey_id)
      .single();

    if (!survey || survey.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ trace });
  } catch (err) {
    console.error('[api/ai/trace] fetch failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
