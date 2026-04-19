import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { aiResponseSchema } from '@/lib/ai/schema';
import { buildSystemPrompt } from '@/lib/ai/prompts';
import { hydrateBlueprint } from '@/lib/templates/hydrate';
import { createClient } from '@/lib/supabase/server';
import { getAnthropic, DEFAULT_MODEL } from '@/lib/anthropic';
import { persistTrace } from '@/lib/ai/trace-server';
import { preserveCanvasUiPreferences } from '@/lib/ai/settings';

/**
 * POST /api/ai/chat
 * Authenticated survey-creator chat. Backed by Claude Opus 4.7 (or a
 * per-survey override in `settings.aiContext.model`) with structured
 * output via zod — returns one of four intents: clarify, propose,
 * generate, command. Every turn persists an ai_traces row; the response
 * includes the resulting trace_id so the client can open the AI Inspector.
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
  let surveyIdForTrace: string | null = null;
  let userMessageForTrace = '';

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { surveyId, message, history } = await req.json();
    surveyIdForTrace = surveyId ?? null;
    userMessageForTrace = message ?? '';

    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (surveyError || !survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    const aiContext = (survey.settings?.aiContext ?? {}) as {
      model?: string;
      temperature?: number;
      systemPromptOverride?: string;
      styleGuidance?: string;
    };
    const model = typeof aiContext.model === 'string' && aiContext.model ? aiContext.model : DEFAULT_MODEL;
    const temperature = typeof aiContext.temperature === 'number' ? aiContext.temperature : undefined;
    traceModel = model;

    const systemPrompt = buildSystemPrompt(survey);
    traceSystemPrompt = systemPrompt;

    const messages = [
      ...history
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
      console.error('[ai/chat] JSON parse failed:', cleaned.slice(0, 500));
      const tid = await persistTrace({
        surveyId: surveyIdForTrace,
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
      console.error('[ai/chat] Zod validation failed:', zodResult.error.flatten());
      const tid = await persistTrace({
        surveyId: surveyIdForTrace,
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

    await supabase.from('chat_messages').insert([
      { survey_id: surveyId, role: 'user', content: message },
      { survey_id: surveyId, role: 'assistant', content: parsed.message },
    ]);

    const traceId = await persistTrace({
      surveyId: surveyIdForTrace,
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
          settings: preserveCanvasUiPreferences(result.settings, survey.settings),
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
      const mergedSettings = preserveCanvasUiPreferences(result.settings, survey.settings);

      await supabase
        .from('surveys')
        .update({
          title: result.title,
          description: result.description,
          schema: result.elements,
          settings: mergedSettings,
        })
        .eq('id', surveyId);

      return NextResponse.json({
        intent: 'generate',
        message: parsed.message,
        survey: {
          title: result.title,
          description: result.description,
          elements: result.elements,
          settings: mergedSettings,
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
    traceError = error instanceof Error ? error.message : String(error);
    console.error('AI chat error:', error);
    const tid = await persistTrace({
      surveyId: surveyIdForTrace,
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
    return NextResponse.json(
      { error: 'Failed to process request', traceId: tid },
      { status: 500 }
    );
  }
}
