import { NextRequest, NextResponse } from 'next/server';
import type { SurveyElement } from '@/types/survey';
import { nanoid } from 'nanoid';
import { getAnthropic, FAST_MODEL } from '@/lib/anthropic';
import { requireAuth } from '@/lib/api/require-auth';
import { log } from '@/lib/log';

/**
 * POST /api/ai/responses
 * Generates realistic dummy survey responses using Claude Haiku 4.5.
 * Low-stakes task — fast + cheap model is the right pick here.
 *
 * Auth-gated: cost-engine route (calls Anthropic).
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured.' },
        { status: 500 }
      );
    }

    const { elements, count, title } = (await req.json()) as {
      elements: SurveyElement[];
      count: number;
      title: string;
    };

    const answerable = elements.filter(
      (el) => !['section_header', 'page_break', 'file_upload'].includes(el.type)
    );

    if (answerable.length === 0) {
      return NextResponse.json({ responses: [] });
    }

    const questionDescriptions = answerable.map((el, i) => {
      let desc = `Q${i + 1} (id: "${el.id}", type: ${el.type}): "${el.title}"`;
      if (el.type === 'multiple_choice' || el.type === 'dropdown') {
        desc += ` | Options: ${el.options.map((o) => `"${o}"`).join(', ')}`;
      }
      if (el.type === 'checkboxes') {
        desc += ` | Options: ${el.options.map((o) => `"${o}"`).join(', ')} | (select 1-3)`;
      }
      if (el.type === 'linear_scale') {
        desc += ` | Scale: ${el.min}-${el.max}`;
        if (el.minLabel) desc += ` (${el.minLabel})`;
        if (el.maxLabel) desc += ` to (${el.maxLabel})`;
      }
      if (el.type === 'short_text') desc += ' | (short answer, 2-8 words)';
      if (el.type === 'long_text') desc += ' | (detailed answer, 1-3 sentences)';
      if (el.type === 'date') desc += ' | (ISO date within last 30 days)';
      if (el.type === 'nps') desc += ` | NPS 0-10${el.minLabel ? ` (0=${el.minLabel}` : ''}${el.maxLabel ? `, 10=${el.maxLabel})` : ')'}`;
      if (el.type === 'slider') {
        desc += ` | Number ${el.min}-${el.max}${el.unit ? ` ${el.unit}` : ''}${el.step ? ` (step ${el.step})` : ''}`;
      }
      if (el.type === 'matrix_single') {
        desc += ` | Rows: ${el.rows.map((r) => `"${r}"`).join(', ')} | Columns: ${el.columns.map((c) => `"${c}"`).join(', ')}`;
      }
      if (el.type === 'matrix_multi') {
        desc += ` | Rows: ${el.rows.map((r) => `"${r}"`).join(', ')} | Columns: ${el.columns.map((c) => `"${c}"`).join(', ')} | (each row: array of 1-3 columns)`;
      }
      if (el.type === 'likert') {
        desc += ` | Rows: ${el.rows.map((r) => `"${r}"`).join(', ')} | Scale: 1-${el.scale}`;
      }
      if (el.type === 'ranking') {
        desc += ` | Items to rank: ${el.items.map((it) => `"${it}"`).join(', ')}`;
      }
      if (el.type === 'image_choice') {
        desc += ` | Options: ${el.options.map((o) => `"${o.label}"`).join(', ')}${el.multiSelect ? ' | (array of 1-2 options)' : ''}`;
      }
      return desc;
    });

    const systemPrompt = `You are a survey response simulator. Generate ${count} realistic, diverse dummy responses for the survey titled "${title}".

Each response should come from a different simulated persona with varying demographics, opinions, and satisfaction levels. Make the responses feel authentic — not all positive, include some neutral and negative perspectives.

Questions:
${questionDescriptions.join('\n')}

Return ONLY a JSON object (no prose, no markdown fences) with this exact structure:
{
  "responses": [
    {
      "answers": {
        "<element_id>": <value>
      }
    }
  ]
}

Value formats per question type:
- multiple_choice / dropdown: a single string matching one of the options exactly
- checkboxes: an array of 1-3 strings matching options exactly
- linear_scale: a number within the specified range
- short_text: a short string (2-8 words)
- long_text: a detailed string (1-3 sentences)
- date: ISO date string (YYYY-MM-DD) within the last 30 days
- nps: a whole number 0-10 (bias toward 7-9 for typical products, but include some detractors)
- slider: a number in the specified range (can be integer or decimal based on step)
- matrix_single: an ARRAY indexed by row — each entry is a column label string, e.g. ["Good", "OK", "Good"]
- matrix_multi: an ARRAY indexed by row — each entry is an ARRAY of column labels, e.g. [["A", "B"], ["A"]]
- likert: an ARRAY indexed by row — each entry is a number 1..scale
- ranking: an ARRAY of all item labels in preferred order, most-preferred first
- image_choice: a single label string, OR (if multiSelect) an array of labels

Guidelines:
- Use weighted distributions (not uniform random) — most real surveys have natural clustering
- For satisfaction scales, use a slight positive bias (bell curve centered around 60-70%)
- For text responses, vary tone, length, and specificity across respondents
- Include some responses that mention specific features, issues, or suggestions
- Generate exactly ${count} response objects`;

    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 16000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `Generate ${count} responses now. Return only the JSON object.` },
      ],
    });

    // Anthropic returns a content-block array; concatenate the text blocks.
    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    if (!raw) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 502 });
    }

    // Strip potential markdown fences Claude sometimes adds despite instructions.
    const cleaned = raw
      .replace(/^\s*```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      log.error({
        event: 'ai.responses.parse_failed',
        sample: cleaned.slice(0, 500),
      });
      return NextResponse.json({ error: 'Invalid AI response format' }, { status: 502 });
    }

    const now = new Date();
    const responses = (parsed.responses || []).map(
      (r: { answers: Record<string, unknown> }, index: number) => ({
        id: `resp_${nanoid(8)}`,
        answers: r.answers || {},
        submittedAt: new Date(
          now.getTime() - (count - index) * 3600_000 * Math.random()
        ).toISOString(),
        respondentMetadata: {
          respondentIndex: index + 1,
          simulatedAt: now.toISOString(),
        },
      })
    );

    return NextResponse.json({ responses });
  } catch (error) {
    log.error({
      event: 'ai.responses.generate_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Type import for narrowing content blocks
import type Anthropic from '@anthropic-ai/sdk';
