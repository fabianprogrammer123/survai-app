import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { SurveyElement } from '@/types/survey';
import { nanoid } from 'nanoid';

// Placeholder lets `next build` succeed when OPENAI_API_KEY is only a
// runtime secret. Handlers guard before making real calls.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'build-placeholder',
});

/**
 * POST /api/ai/responses
 * Generates realistic dummy survey responses using GPT-4o.
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured.' },
        { status: 500 }
      );
    }

    const { elements, count, title } = (await req.json()) as {
      elements: SurveyElement[];
      count: number;
      title: string;
    };

    // Filter to answerable elements only
    const answerable = elements.filter(
      (el) => !['section_header', 'page_break', 'file_upload'].includes(el.type)
    );

    if (answerable.length === 0) {
      return NextResponse.json({ responses: [] });
    }

    // Build a description of each question for the AI
    const questionDescriptions = answerable.map((el, i) => {
      let desc = `Q${i + 1} (id: "${el.id}", type: ${el.type}): "${el.title}"`;
      if (el.type === 'multiple_choice' || el.type === 'checkboxes' || el.type === 'dropdown') {
        const opts = 'options' in el ? el.options : [];
        desc += ` | Options: ${opts.map((o) => `"${o}"`).join(', ')}`;
        if (el.type === 'checkboxes') desc += ' | (select 1-3)';
      }
      if (el.type === 'linear_scale') {
        desc += ` | Scale: ${el.min}-${el.max}`;
        if (el.minLabel) desc += ` (${el.minLabel})`;
        if (el.maxLabel) desc += ` to (${el.maxLabel})`;
      }
      if (el.type === 'short_text') desc += ' | (short answer, 2-8 words)';
      if (el.type === 'long_text') desc += ' | (detailed answer, 1-3 sentences)';
      if (el.type === 'date') desc += ' | (ISO date within last 30 days)';
      return desc;
    });

    const systemPrompt = `You are a survey response simulator. Generate ${count} realistic, diverse dummy responses for the survey titled "${title}".

Each response should come from a different simulated persona with varying demographics, opinions, and satisfaction levels. Make the responses feel authentic — not all positive, include some neutral and negative perspectives.

Questions:
${questionDescriptions.join('\n')}

Return a JSON object with this exact structure:
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

Guidelines:
- Use weighted distributions (not uniform random) — most real surveys have natural clustering
- For satisfaction scales, use a slight positive bias (bell curve centered around 60-70%)
- For text responses, vary tone, length, and specificity across respondents
- Include some responses that mention specific features, issues, or suggestions
- Generate exactly ${count} response objects`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate ${count} responses now.` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.9,
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
    const now = new Date();

    // Add IDs and timestamps to each response
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
    console.error('Response generation error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
