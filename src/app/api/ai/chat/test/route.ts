import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { aiResponseSchema } from '@/lib/ai/schema';
import { buildSystemPrompt } from '@/lib/ai/prompts';
import { hydrateBlueprint } from '@/lib/templates/hydrate';
import { DEFAULT_SETTINGS } from '@/types/survey';
import { getAnthropic, DEFAULT_MODEL } from '@/lib/anthropic';

/**
 * POST /api/ai/chat/test
 * Test endpoint — no Supabase auth or DB persistence. Used by the public
 * /test/edit path where surveys live in localStorage, not Supabase.
 * Backed by Claude Opus 4.7 with structured output.
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured. Add it to .env.local and restart.' },
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

    const messages = [
      ...(history || [])
        .filter((m: { role: string }) => m.role === 'user' || m.role === 'assistant')
        .map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      { role: 'user' as const, content: message },
    ];

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
      console.error('[ai/chat/test] JSON parse failed:', cleaned.slice(0, 500));
      return NextResponse.json({ error: 'Invalid AI response format' }, { status: 502 });
    }

    const zodResult = aiResponseSchema.safeParse(parsedRaw);
    if (!zodResult.success) {
      console.error('[ai/chat/test] Zod validation failed:', zodResult.error.flatten());
      return NextResponse.json({ error: 'AI response did not match schema' }, { status: 502 });
    }
    const parsed = zodResult.data;

    if (parsed.intent === 'clarify') {
      return NextResponse.json({
        intent: 'clarify',
        message: parsed.message,
        clarifyingQuestions: parsed.clarifyingQuestions || [],
      });
    }

    if (parsed.intent === 'propose') {
      const hydratedProposals = (parsed.proposals || []).map((p) => {
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
