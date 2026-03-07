import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { answers } = await req.json();
    const supabase = await createClient();

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
    const { error } = await supabase.from('responses').insert({
      survey_id: id,
      answers,
      respondent_metadata: {
        userAgent: req.headers.get('user-agent'),
        submittedAt: new Date().toISOString(),
      },
    });

    if (error) {
      console.error('Failed to store response:', error);
      return NextResponse.json(
        { error: 'Failed to submit response' },
        { status: 500 }
      );
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
