import { NextRequest } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { aiResponseSchema } from '@/lib/ai/schema';
import { buildSystemPrompt } from '@/lib/ai/prompts';
import { hydrateBlueprint } from '@/lib/templates/hydrate';
import { DEFAULT_SETTINGS } from '@/types/survey';
import { getAnthropic, DEFAULT_MODEL } from '@/lib/anthropic';

/**
 * POST /api/ai/chat/test/stream
 * SSE streaming test endpoint. Emits status events while Claude thinks,
 * then streams the hydrated result element-by-element.
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

      try {
        send('status', { text: 'Understanding your request...' });

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

        send('status', { text: 'Designing your survey...' });

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

        const usage = response.usage;
        send('trace', {
          tokenUsage: usage
            ? { input: usage.input_tokens, output: usage.output_tokens, cacheRead: usage.cache_read_input_tokens }
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
          send('error', { error: 'Invalid AI response format' });
          controller.close();
          return;
        }

        const zodResult = aiResponseSchema.safeParse(parsedRaw);
        if (!zodResult.success) {
          send('error', { error: 'AI response did not match schema' });
          controller.close();
          return;
        }
        const parsed = zodResult.data;

        if (parsed.intent === 'clarify') {
          send('result', {
            intent: 'clarify',
            message: parsed.message,
            clarifyingQuestions: parsed.clarifyingQuestions || [],
          });
          controller.close();
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
          controller.close();
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
          controller.close();
          return;
        }

        // Command intent
        send('result', {
          intent: 'command',
          message: parsed.message,
          commands: parsed.commands,
        });
        controller.close();
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Internal server error';
        send('error', { error: msg });
        controller.close();
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
