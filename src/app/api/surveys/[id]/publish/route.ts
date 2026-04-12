import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/surveys/[id]/publish
 * Marks a survey as published in the database.
 * Optionally stores agentId and publicUrl.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { agentId, publicUrl } = body;

    const supabase = await createClient();

    // Verify the user owns this survey
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: survey, error: fetchError } = await supabase
      .from('surveys')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    if (survey.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update the survey
    const updates: Record<string, unknown> = {
      published: true,
      published_at: new Date().toISOString(),
    };
    if (agentId) updates.agent_id = agentId;
    if (publicUrl) updates.public_url = publicUrl;

    const { error: updateError } = await supabase
      .from('surveys')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      console.error('Publish update failed:', updateError);
      return NextResponse.json({ error: 'Failed to publish survey' }, { status: 500 });
    }

    return NextResponse.json({
      surveyId: id,
      publicUrl: publicUrl || `${req.nextUrl.origin}/s/${id}`,
      published: true,
    });
  } catch (error) {
    console.error('Publish error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
