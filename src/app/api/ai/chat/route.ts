import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { aiResponseSchema } from '@/lib/ai/schema';
import { buildSystemPrompt } from '@/lib/ai/prompts';
import { createClient } from '@/lib/supabase/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { surveyId, message, history } = await req.json();

    // Fetch current survey state
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (surveyError || !survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    const systemPrompt = buildSystemPrompt(survey);

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.parse({
      model: 'gpt-4o',
      messages,
      response_format: zodResponseFormat(aiResponseSchema, 'survey_response'),
      temperature: 0.7,
    });

    const parsed = completion.choices[0].message.parsed;

    if (!parsed) {
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    // Persist chat messages
    await supabase.from('chat_messages').insert([
      { survey_id: surveyId, role: 'user', content: message },
      { survey_id: surveyId, role: 'assistant', content: parsed.message },
    ]);

    // Update survey with AI-generated content
    await supabase
      .from('surveys')
      .update({
        title: parsed.survey.title,
        description: parsed.survey.description,
        schema: parsed.survey.elements,
        settings: parsed.survey.settings,
      })
      .eq('id', surveyId);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
