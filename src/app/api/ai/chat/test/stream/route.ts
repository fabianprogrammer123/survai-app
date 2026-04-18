import { NextRequest } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { aiResponseSchema } from '@/lib/ai/schema';
import { buildSystemPrompt } from '@/lib/ai/prompts';
import { hydrateBlueprint } from '@/lib/templates/hydrate';
import { DEFAULT_SETTINGS, type SurveySettings } from '@/types/survey';
import { getAnthropic, DEFAULT_MODEL } from '@/lib/anthropic';
import { persistTrace } from '@/lib/ai/trace-server';

/**
 * POST /api/ai/chat/test/stream
 * SSE streaming /test entry point. Emits status events while Claude thinks,
 * streams the hydrated result element-by-element, and closes with a
 * `trace_id` event carrying the persisted ai_traces row id (or null on
 * persist failure).
 */
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { message, history, currentSurvey } = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

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

      async function emitTraceAndClose() {
        const traceId = await persistTrace({
          surveyId: null,
          userMessage: message ?? '',
          systemPrompt: traceSystemPrompt,
          durationMs: Date.now() - start,
          intent: traceIntent,
          model: traceModel,
          inputTokens: traceInputTokens,
          outputTokens: traceOutputTokens,
          proposalsCount: traceProposalsCount,
          commands: traceCommands,
          rawResponse: traceRaw,
          error: traceError,
        });
        send('trace_id', { traceId });
        controller.close();
      }

      try {
        send('status', { text: 'Understanding your request...' });

        const settings = (currentSurvey?.settings ?? DEFAULT_SETTINGS) as SurveySettings;
        const aiContext = settings.aiContext ?? {};
        const model =
          aiContext.model && typeof aiContext.model === 'string'
            ? aiContext.model
            : DEFAULT_MODEL;
        const temperature =
          typeof aiContext.temperature === 'number' ? aiContext.temperature : undefined;
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

        send('status', { text: 'Designing your survey...' });

        const anthropic = getAnthropic();
        const response = await anthropic.messages.create({
          model,
          max_tokens: 16000,
          ...(temperature !== undefined ? { temperature } : {}),
          system: systemPrompt + '\n\nReturn ONLY a JSON object matching the survey_response schema. No prose, no markdown fences.',
          messages,
        });

        const raw = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');
        traceRaw = raw;
        traceModel = response.model;
        traceInputTokens = response.usage?.input_tokens ?? null;
        traceOutputTokens = response.usage?.output_tokens ?? null;

        send('trace', {
          tokenUsage: response.usage
            ? {
                input: response.usage.input_tokens,
                output: response.usage.output_tokens,
                cacheRead: response.usage.cache_read_input_tokens,
              }
            : null,
          model: response.model,
          stopReason: response.stop_reason,
          systemPromptLength: systemPrompt.length,
        });

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
          send('error', { error: 'Invalid AI response format' });
          await emitTraceAndClose();
          return;
        }

        const zodResult = aiResponseSchema.safeParse(parsedRaw);
        if (!zodResult.success) {
          traceIntent = 'error';
          traceError = 'Zod validation failed';
          send('error', { error: 'AI response did not match schema' });
          await emitTraceAndClose();
          return;
        }
        const parsed = zodResult.data;
        traceIntent = parsed.intent;
        traceProposalsCount = parsed.proposals?.length ?? null;
        traceCommands = parsed.commands ?? null;

        if (parsed.intent === 'clarify') {
          send('result', {
            intent: 'clarify',
            message: parsed.message,
            clarifyingQuestions: parsed.clarifyingQuestions || [],
          });
          await emitTraceAndClose();
          return;
        }

        if (parsed.intent === 'propose') {
          send('status', { text: 'Preparing proposals...' });

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

          send('result', {
            intent: 'propose',
            message: parsed.message,
            proposals: hydratedProposals,
          });
          await emitTraceAndClose();
          return;
        }

        if (parsed.intent === 'generate') {
          send('status', { text: 'Building survey elements...' });

          const result = hydrateBlueprint(parsed.blueprint as Parameters<typeof hydrateBlueprint>[0]);

          send('generation_start', {
            message: parsed.message,
            title: result.title,
            description: result.description,
            settings: result.settings,
            blockMap: result.blockMap,
            blueprint: parsed.blueprint,
            totalElements: result.elements.length,
          });

          for (let i = 0; i < result.elements.length; i++) {
            send('element', {
              element: result.elements[i],
              index: i,
              total: result.elements.length,
            });
          }

          send('generation_complete', {
            errors: result.errors.length > 0 ? result.errors : undefined,
          });
          await emitTraceAndClose();
          return;
        }

        send('result', {
          intent: 'command',
          message: parsed.message,
          commands: parsed.commands,
        });
        await emitTraceAndClose();
      } catch (error) {
        traceIntent = 'error';
        traceError = error instanceof Error ? error.message : 'Internal server error';
        const msg = error instanceof Error ? error.message : 'Internal server error';
        send('error', { error: msg });
        await emitTraceAndClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
