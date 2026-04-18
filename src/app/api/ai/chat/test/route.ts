import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { aiResponseSchema } from '@/lib/ai/schema';
import { buildSystemPrompt } from '@/lib/ai/prompts';
import { hydrateBlueprint } from '@/lib/templates/hydrate';
import { DEFAULT_SETTINGS } from '@/types/survey';

// Placeholder lets `next build` succeed when OPENAI_API_KEY is only a
// runtime secret. Handlers guard before making real calls.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'build-placeholder',
});

/**
 * Test endpoint — no Supabase auth or DB persistence.
 * Simple request/response (no SSE streaming).
 * Only needs OPENAI_API_KEY in .env.local.
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured. Add it to .env.local and restart.' },
        { status: 500 }
      );
    }

    const { message, history, currentSurvey } = await req.json();

    const systemPrompt = buildSystemPrompt(
      currentSurvey || {
        title: 'Untitled Survey',
        description: '',
        schema: [],
        settings: DEFAULT_SETTINGS,
      }
    );

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map((msg: { role: string; content: string }) => ({
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
      // Hydrate the blueprint into real SurveyElements
      const result = hydrateBlueprint(parsed.blueprint);

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

    // Command intent — pass through
    return NextResponse.json({
      intent: 'command',
      message: parsed.message,
      commands: parsed.commands,
    });
  } catch (error) {
    console.error('AI chat error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
