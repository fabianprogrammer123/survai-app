import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/surveys/[id]/guests/[token]
 * Public endpoint — returns guest name + survey data for the personalized survey page.
 * The token acts as authentication.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; token: string }> }
) {
  try {
    const { id, token } = await params;

    // Use service client since this is a public endpoint (no auth)
    let supabase;
    try {
      supabase = createServiceClient();
    } catch {
      // Supabase not configured — return mock for local dev
      return NextResponse.json({
        guest: { name: 'Test Guest', token, status: 'invited' },
        survey: { id, title: 'Test Survey', schema: [], settings: {} },
      });
    }

    // Look up guest by token + survey_id
    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .select('id, name, email, token, status, response_id, profile')
      .eq('survey_id', id)
      .eq('token', token)
      .single();

    if (guestError || !guest) {
      return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
    }

    // Get the published survey
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('id, title, description, schema, settings, agent_id, published')
      .eq('id', id)
      .eq('published', true)
      .single();

    if (surveyError || !survey) {
      return NextResponse.json({ error: 'Survey not available' }, { status: 404 });
    }

    // Mark guest as started if still invited
    if (guest.status === 'invited') {
      await supabase
        .from('guests')
        .update({ status: 'started' })
        .eq('id', guest.id);
    }

    return NextResponse.json({ guest, survey });
  } catch (error) {
    console.error('Guest lookup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
