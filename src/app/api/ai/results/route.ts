import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { buildResultsSystemPrompt } from '@/lib/ai/results-prompts';
import type { SurveyElement, SurveyResponseData } from '@/types/survey';
import { getAnthropic, DEFAULT_MODEL } from '@/lib/anthropic';

/**
 * POST /api/ai/results
 * Analyzes survey responses and returns A2UI component specs for the dashboard.
 * Backed by Claude Opus 4.7 — this is a high-stakes analysis task.
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured.' },
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

    const chatMessages = [
      ...(history || [])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      {
        role: 'user' as const,
        content: message || 'Generate an overview dashboard with charts for all survey questions. Return only the JSON object — no prose, no markdown fences.',
      },
    ];

    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 16000,
      system: systemPrompt + '\n\nReturn ONLY a JSON object. No prose, no markdown fences.',
      messages: chatMessages,
    });

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    if (!raw) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 502 });
    }

    const cleaned = raw
      .replace(/^\s*```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse AI response:', cleaned.slice(0, 500));
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
