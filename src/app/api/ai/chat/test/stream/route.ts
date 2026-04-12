import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { aiResponseSchema } from '@/lib/ai/schema';
import { buildSystemPrompt } from '@/lib/ai/prompts';
import { hydrateBlueprint } from '@/lib/templates/hydrate';
import { DEFAULT_SETTINGS } from '@/types/survey';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * SSE streaming test endpoint.
 * Sends status updates while waiting for OpenAI, then streams
 * the hydrated result element-by-element.
 */
export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'OPENAI_API_KEY not configured.' }),
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

        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: 'system', content: systemPrompt },
          ...(history || []).map((msg: { role: string; content: string }) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
          { role: 'user', content: message },
        ];

        send('status', { text: 'Designing your survey...' });

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages,
          response_format: zodResponseFormat(aiResponseSchema, 'survey_response'),
          temperature: 0.3,
        });

        const raw = completion.choices[0]?.message?.content;
        const usage = completion.usage;

        // Emit trace data for admin observability
        send('trace', {
          tokenUsage: usage ? { prompt: usage.prompt_tokens, completion: usage.completion_tokens, total: usage.total_tokens } : null,
          model: completion.model,
          systemPromptLength: systemPrompt.length,
          rawResponse: raw,
        });

        if (!raw) {
          send('error', { error: 'No response from AI' });
          controller.close();
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          console.error('Failed to parse AI response:', raw?.slice(0, 500));
          send('error', { error: 'Invalid AI response format' });
          controller.close();
          return;
        }

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

          const result = hydrateBlueprint(parsed.blueprint);

          // Send metadata first
          send('generation_start', {
            message: parsed.message,
            title: result.title,
            description: result.description,
            settings: result.settings,
            blockMap: result.blockMap,
            blueprint: parsed.blueprint,
            totalElements: result.elements.length,
          });

          // Stream each element individually
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
