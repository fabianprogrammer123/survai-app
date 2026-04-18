import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { aiResponseSchema } from '@/lib/ai/schema';
import { buildSystemPrompt } from '@/lib/ai/prompts';
import { hydrateBlueprint } from '@/lib/templates/hydrate';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_SETTINGS } from '@/types/survey';

// Lazy-safe init: placeholder lets `next build` page-data collection succeed
// when the real key is only available at runtime (Secret Manager on Cloud Run).
// Handlers still guard on process.env.OPENAI_API_KEY before making calls.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'build-placeholder',
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { surveyId, message, history } = await req.json();

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

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      response_format: zodResponseFormat(aiResponseSchema, 'survey_response'),
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 502 });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error('Failed to parse AI response:', raw?.slice(0, 500));
      return NextResponse.json({ error: 'Invalid AI response format' }, { status: 502 });
    }

    // Persist chat messages
    await supabase.from('chat_messages').insert([
      { survey_id: surveyId, role: 'user', content: message },
      { survey_id: surveyId, role: 'assistant', content: parsed.message },
    ]);

    if (parsed.intent === 'clarify') {
      return NextResponse.json({
        intent: 'clarify',
        message: parsed.message,
        clarifyingQuestions: parsed.clarifyingQuestions || [],
      });
    }

    if (parsed.intent === 'propose') {
      // Hydrate each proposal's blueprint into real elements
      const hydratedProposals = (parsed.proposals || []).map(
        (p: { label: string; description?: string; blueprint: Parameters<typeof hydrateBlueprint>[0] }) => {
          const result = hydrateBlueprint(p.blueprint);
          return {
            label: p.label,
            description: p.description,
            elements: result.elements,
            settings: result.settings,
            blockMap: result.blockMap,
          };
        }
      );

      return NextResponse.json({
        intent: 'propose',
        message: parsed.message,
        proposals: hydratedProposals,
      });
    }

    if (parsed.intent === 'generate') {
      const result = hydrateBlueprint(parsed.blueprint);

      // Persist to DB
      await supabase
        .from('surveys')
        .update({
          title: result.title,
          description: result.description,
          schema: result.elements,
          settings: result.settings,
        })
        .eq('id', surveyId);

      return NextResponse.json({
        intent: 'generate',
        message: parsed.message,
        survey: {
          title: result.title,
          description: result.description,
          elements: result.elements,
          settings: result.settings,
        },
        blockMap: result.blockMap,
        blueprint: parsed.blueprint,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    }

    // Command intent
    return NextResponse.json({
      intent: 'command',
      message: parsed.message,
      commands: parsed.commands,
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
