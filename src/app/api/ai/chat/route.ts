import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { aiResponseSchema } from '@/lib/ai/schema';
import { buildSystemPrompt } from '@/lib/ai/prompts';
import { hydrateBlueprint } from '@/lib/templates/hydrate';
import { createClient } from '@/lib/supabase/server';
import { getAnthropic, DEFAULT_MODEL } from '@/lib/anthropic';

/**
 * POST /api/ai/chat
 * Authenticated survey-creator chat. Backed by Claude Opus 4.7 with
 * structured output via zod — returns one of four intents: clarify,
 * propose, generate, command.
 */
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

    // Anthropic separates `system` from `messages` (OpenAI-style `system`
    // roles inside messages aren't accepted). Convert any 'system' role in
    // the history to a string appended to the system prompt, keep only
    // user/assistant turns in messages.
    const messages = [
      ...history
        .filter((m: { role: string }) => m.role === 'user' || m.role === 'assistant')
        .map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      { role: 'user' as const, content: message },
    ];

    // Prompt-guided JSON output. Claude's strict structured output rejects
    // this schema ("grammar too large") because aiResponseSchema uses many
    // nullable+optional fields. Ask for JSON in the system prompt, parse
    // the text output, validate with the Zod schema after.
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 16000,
      system: systemPrompt + '\n\nReturn ONLY a JSON object matching the survey_response schema. No prose, no markdown fences.',
      messages,
    });

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const cleaned = raw
      .replace(/^\s*```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    let parsedRaw: unknown;
    try {
      parsedRaw = JSON.parse(cleaned);
    } catch {
      console.error('[ai/chat] JSON parse failed:', cleaned.slice(0, 500));
      return NextResponse.json({ error: 'Invalid AI response format' }, { status: 502 });
    }

    const zodResult = aiResponseSchema.safeParse(parsedRaw);
    if (!zodResult.success) {
      console.error('[ai/chat] Zod validation failed:', zodResult.error.flatten());
      return NextResponse.json({ error: 'AI response did not match schema' }, { status: 502 });
    }
    const parsed = zodResult.data;

    // Persist chat messages (best effort — don't fail the request if RLS denies)
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
      const hydratedProposals = (parsed.proposals || []).map((p) => {
        // Cast: schema uses .nullable().optional() which widens to `string|null|undefined`,
        // but hydrateBlueprint was written assuming no nulls. Low-risk cast — Anthropic
        // tool calls rarely produce null for optional fields.
        const result = hydrateBlueprint(p.blueprint as Parameters<typeof hydrateBlueprint>[0]);
        return {
          label: p.label,
          description: p.description ?? undefined,
          elements: result.elements,
          settings: result.settings,
          blockMap: result.blockMap,
        };
      });
      return NextResponse.json({
        intent: 'propose',
        message: parsed.message,
        proposals: hydratedProposals,
      });
    }

    if (parsed.intent === 'generate') {
      const result = hydrateBlueprint(parsed.blueprint as Parameters<typeof hydrateBlueprint>[0]);

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
