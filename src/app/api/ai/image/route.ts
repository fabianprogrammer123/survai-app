import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireAuth } from '@/lib/api/require-auth';
import { log } from '@/lib/log';

// Placeholder lets `next build` succeed when OPENAI_API_KEY is only a
// runtime secret. Handlers guard before making real calls.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'build-placeholder',
});

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    }

    const result = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `Abstract, atmospheric background image for a survey form: ${prompt}. No text, no UI elements, subtle and artistic.`,
      n: 1,
      size: '1792x1024',
      quality: 'standard',
    });

    const url = result.data?.[0]?.url;
    if (!url) {
      return NextResponse.json({ error: 'No image URL returned' }, { status: 502 });
    }
    return NextResponse.json({ url });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error({ event: 'ai.image.generate_failed', error: msg });
    return NextResponse.json({ error: msg || 'Image generation failed' }, { status: 500 });
  }
}
