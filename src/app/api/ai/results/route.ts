import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { buildResultsSystemPrompt } from '@/lib/ai/results-prompts';
import type { SurveyElement, SurveyResponseData } from '@/types/survey';

// Placeholder lets `next build` succeed when OPENAI_API_KEY is only a
// runtime secret. Handlers guard before making real calls.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'build-placeholder',
});

/**
 * POST /api/ai/results
 * Analyzes survey responses and returns A2UI component specs for the dashboard.
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured.' },
        { status: 500 }
      );
    }

    const { message, elements, responses, history } = (await req.json()) as {
      message?: string;
      elements: SurveyElement[];
      responses: SurveyResponseData[];
      history?: { role: string; content: string }[];
    };

    const systemPrompt = buildResultsSystemPrompt(elements, responses);

    const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user',
        content: message || 'Generate an overview dashboard with charts for all survey questions.',
      },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: chatMessages,
      response_format: { type: 'json_object' },
      temperature: 0.5,
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

    // Convert the flat component list into A2UI messages
    const a2uiMessages = convertToA2UIMessages(parsed.components);

    return NextResponse.json({
      message: parsed.message,
      a2uiMessages,
      components: parsed.components,
    });
  } catch (error) {
    console.error('Results analysis error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Convert our flat component definitions into proper A2UI messages.
 */
function convertToA2UIMessages(
  components: Array<{
    id: string;
    componentType: string;
    props: Record<string, unknown>;
    children?: string[] | null;
    weight?: number | null;
  }>
) {
  // Find the root component (should be "root" or first Column)
  const root = components.find((c) => c.id === 'root') || components[0];
  if (!root) return [];

  // Build A2UI surfaceUpdate components
  const a2uiComponents = components.map((c) => {
    const componentProps: Record<string, unknown> = { ...c.props };

    // Handle children — A2UI uses explicitList inside the component props
    if (c.children && c.children.length > 0) {
      componentProps.children = { explicitList: c.children };
    }

    return {
      id: c.id,
      weight: c.weight ?? undefined,
      component: {
        [c.componentType]: componentProps,
      },
    };
  });

  return [
    {
      beginRendering: {
        surfaceId: 'results-dashboard',
        root: root.id,
      },
    },
    {
      surfaceUpdate: {
        surfaceId: 'results-dashboard',
        components: a2uiComponents,
      },
    },
  ];
}
