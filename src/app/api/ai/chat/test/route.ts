import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { aiResponseSchema } from '@/lib/ai/schema';
import { buildSystemPrompt } from '@/lib/ai/prompts';
import { hydrateBlueprint } from '@/lib/templates/hydrate';
import { DEFAULT_SETTINGS, type SurveySettings } from '@/types/survey';
import { getAnthropic, DEFAULT_MODEL } from '@/lib/anthropic';
import { persistTrace } from '@/lib/ai/trace-server';

/**
 * POST /api/ai/chat/test
 * Anonymous /test/edit entry point — no Supabase auth or survey persistence;
 * the survey lives in localStorage client-side. Traces are persisted with
 * survey_id=null so the AI Inspector can still show them.
 */
export async function POST(req: NextRequest) {
  const start = Date.now();
  let traceSystemPrompt = '';
  let traceIntent: 'generate' | 'propose' | 'command' | 'clarify' | 'error' | null = null;
  let traceModel: string | null = null;
  let traceInputTokens: number | null = null;
  let traceOutputTokens: number | null = null;
  let traceProposalsCount: number | null = null;
  let traceCommands: unknown = null;
  let traceRaw: string | null = null;
  let traceError: string | null = null;
  let userMessageForTrace = '';

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured. Add it to .env.local and restart.' },
        { status: 500 }
      );
    }

    const { message, history, currentSurvey } = await req.json();
    userMessageForTrace = message ?? '';

    const settings = (currentSurvey?.settings ?? DEFAULT_SETTINGS) as SurveySettings;
    const aiContext = settings.aiContext ?? {};
    const model = aiContext.model && typeof aiContext.model === 'string' ? aiContext.model : DEFAULT_MODEL;
    const temperature = typeof aiContext.temperature === 'number' ? aiContext.temperature : undefined;
    traceModel = model;

    const systemPrompt = buildSystemPrompt(
      currentSurvey || {
        title: 'Untitled Survey',
        description: '',
        schema: [],
        settings: DEFAULT_SETTINGS,
      }
    );
    traceSystemPrompt = systemPrompt;

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
      model,
      max_tokens: 16000,
      ...(temperature !== undefined ? { temperature } : {}),
      system: systemPrompt + '\n\nReturn ONLY a JSON object matching the survey_response schema. No prose, no markdown fences.',
      messages,
    });

    traceModel = response.model;
    traceInputTokens = response.usage?.input_tokens ?? null;
    traceOutputTokens = response.usage?.output_tokens ?? null;

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    traceRaw = raw;

    const cleaned = raw
      .replace(/^\s*```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    let parsedRaw: unknown;
    try {
      parsedRaw = JSON.parse(cleaned);
    } catch {
      traceIntent = 'error';
      traceError = 'JSON parse failed';
      console.error('[ai/chat/test] JSON parse failed:', cleaned.slice(0, 500));
      const tid = await persistTrace({
        surveyId: null,
        userMessage: userMessageForTrace,
        systemPrompt: traceSystemPrompt,
        durationMs: Date.now() - start,
        intent: traceIntent,
        model: traceModel,
        inputTokens: traceInputTokens,
        outputTokens: traceOutputTokens,
        rawResponse: traceRaw,
        error: traceError,
      });
      return NextResponse.json({ error: 'Invalid AI response format', traceId: tid }, { status: 502 });
    }

    const zodResult = aiResponseSchema.safeParse(parsedRaw);
    if (!zodResult.success) {
      traceIntent = 'error';
      traceError = 'Zod validation failed';
      console.error('[ai/chat/test] Zod validation failed:', zodResult.error.flatten());
      const tid = await persistTrace({
        surveyId: null,
        userMessage: userMessageForTrace,
        systemPrompt: traceSystemPrompt,
        durationMs: Date.now() - start,
        intent: traceIntent,
        model: traceModel,
        inputTokens: traceInputTokens,
        outputTokens: traceOutputTokens,
        rawResponse: traceRaw,
        error: traceError,
      });
      return NextResponse.json({ error: 'AI response did not match schema', traceId: tid }, { status: 502 });
    }
    const parsed = zodResult.data;
    traceIntent = parsed.intent;
    traceProposalsCount = parsed.proposals?.length ?? null;
    traceCommands = parsed.commands ?? null;

    const traceId = await persistTrace({
      surveyId: null,
      userMessage: userMessageForTrace,
      systemPrompt: traceSystemPrompt,
      durationMs: Date.now() - start,
      intent: traceIntent,
      model: traceModel,
      inputTokens: traceInputTokens,
      outputTokens: traceOutputTokens,
      proposalsCount: traceProposalsCount,
      commands: traceCommands,
      rawResponse: traceRaw,
    });

    if (parsed.intent === 'clarify') {
      return NextResponse.json({
        intent: 'clarify',
        message: parsed.message,
        clarifyingQuestions: parsed.clarifyingQuestions || [],
        traceId,
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
        traceId,
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
        traceId,
      });
    }

    return NextResponse.json({
      intent: 'command',
      message: parsed.message,
      commands: parsed.commands,
      traceId,
    });
  } catch (error) {
    traceIntent = 'error';
    traceError = error instanceof Error ? error.message : 'Internal server error';
    console.error('AI chat error:', error);
    const tid = await persistTrace({
      surveyId: null,
      userMessage: userMessageForTrace,
      systemPrompt: traceSystemPrompt,
      durationMs: Date.now() - start,
      intent: traceIntent,
      model: traceModel,
      inputTokens: traceInputTokens,
      outputTokens: traceOutputTokens,
      rawResponse: traceRaw,
      error: traceError,
    });
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg, traceId: tid }, { status: 500 });
  }
}
