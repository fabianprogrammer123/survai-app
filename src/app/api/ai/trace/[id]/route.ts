import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/ai/trace/[id]
 * Returns a single ai_traces row for the AI Inspector drawer.
 *
 * Uses the SSR (user-authenticated) Supabase client so RLS enforces access:
 *   - anon traces (survey_id IS NULL) are readable by anyone with the uuid
 *   - survey-linked traces are readable only by the surveys.user_id owner
 *
 * No service-role fallback: if RLS denies, we return 404 without
 * distinguishing "not found" from "forbidden" to avoid id enumeration.
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
    const supabase = await createClient();
    const { data: trace, error } = await supabase
      .from('ai_traces')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[api/ai/trace] query failed:', error.message);
      return NextResponse.json({ error: 'Trace lookup failed' }, { status: 500 });
    }
    if (!trace) {
      return NextResponse.json({ error: 'Trace not found' }, { status: 404 });
    }
    return NextResponse.json({ trace });
  } catch (err) {
    console.error('[api/ai/trace] fetch threw:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
