import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { answers, guestToken } = await req.json();

    // Use service client since this is a public endpoint (no auth required)
    let supabase;
    try {
      supabase = createServiceClient();
    } catch {
      // Supabase not configured — accept silently for local dev
      return NextResponse.json({ success: true });
    }

    // Verify survey exists and is published
    const { data: survey } = await supabase
      .from('surveys')
      .select('id, published')
      .eq('id', id)
      .eq('published', true)
      .single();

    if (!survey) {
      return NextResponse.json(
        { error: 'Survey not found or not published' },
        { status: 404 }
      );
    }

    // Store the response
    const { data: response, error } = await supabase
      .from('responses')
      .insert({
        survey_id: id,
        answers,
        channel: 'web_form',
        metadata: {
          userAgent: req.headers.get('user-agent'),
          submittedAt: new Date().toISOString(),
        },
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to store response:', error);
      return NextResponse.json(
        { error: 'Failed to submit response' },
        { status: 500 }
      );
    }

    // If a guest token was provided, link the response to the guest
    if (guestToken && response) {
      const { data: guest } = await supabase
        .from('guests')
        .select('id, name')
        .eq('survey_id', id)
        .eq('token', guestToken)
        .single();

      if (guest) {
        await supabase
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
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Submit error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
