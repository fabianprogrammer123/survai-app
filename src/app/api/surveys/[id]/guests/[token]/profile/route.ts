import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { getAnthropic, FAST_MODEL } from '@/lib/anthropic';

/**
 * POST /api/surveys/[id]/guests/[token]/profile
 * Generate an AI profile summary for a guest based on their survey answers.
 * Owner-only endpoint.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; token: string }> }
) {
  try {
    const { id, token } = await params;
    const supabase = await createClient();

    // Get guest + their response
    const { data: guest } = await supabase
      .from('guests')
      .select('id, name, response_id, profile')
      .eq('survey_id', id)
      .eq('token', token)
      .single();

    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    if (!guest.response_id) {
      return NextResponse.json({ error: 'Guest has not responded yet' }, { status: 400 });
    }

    // Get the response data
    const { data: response } = await supabase
      .from('responses')
      .select('answers, metadata')
      .eq('id', guest.response_id)
      .single();

    if (!response) {
      return NextResponse.json({ error: 'Response not found' }, { status: 404 });
    }

    // Get survey for context
    const { data: survey } = await supabase
      .from('surveys')
      .select('title, schema')
      .eq('id', id)
      .single();

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic not configured' }, { status: 500 });
    }

    const answersText = Object.entries(response.answers)
      .map(([key, val]) => `- ${key}: ${val}`)
      .join('\n');

    const metadataText = response.metadata
      ? `Sentiment: ${response.metadata.sentiment || 'unknown'}\nExtra context: ${response.metadata.additionalContext || 'none'}`
      : '';

    const anthropic = getAnthropic();
    const completion = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 400,
      system: 'Write a brief, warm 2-3 sentence guest profile for the host. Include key preferences, interests, and anything notable. Be helpful and concise.',
      messages: [
        {
          role: 'user',
          content: `Guest: ${guest.name}\nSurvey: ${survey?.title || 'Party questionnaire'}\n\nAnswers:\n${answersText}\n\n${metadataText}`,
        },
      ],
    });

    const profileSummary = completion.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    // Update guest with AI profile
    const profile = {
      ...(guest.profile as Record<string, unknown> || {}),
      summary: profileSummary,
      generatedAt: new Date().toISOString(),
    };

    await supabase
      .from('guests')
      .update({ profile })
      .eq('id', guest.id);

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Profile generation error:', error);
    return NextResponse.json({ error: 'Failed to generate profile' }, { status: 500 });
  }
}
