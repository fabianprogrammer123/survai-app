import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeechStream } from '@/lib/elevenlabs/client';

/**
 * POST /api/ai/voice/synthesize
 * Streaming text-to-speech using ElevenLabs (fastest flash model).
 * Falls back to OpenAI if ELEVENLABS_API_KEY is not set.
 *
 * The response streams audio chunks as they arrive from ElevenLabs,
 * enabling playback to start before the full audio is generated.
 */
export async function POST(req: NextRequest) {
  try {
    const { text, voiceId } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    // Try ElevenLabs first for lowest latency
    if (process.env.ELEVENLABS_API_KEY) {
      try {
        const upstream = await synthesizeSpeechStream(text.slice(0, 5000), voiceId);

        if (upstream.body) {
          return new Response(upstream.body, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'Transfer-Encoding': 'chunked',
              'Cache-Control': 'no-cache',
            },
          });
        }
      } catch (elevenErr) {
        console.warn('ElevenLabs TTS failed, trying OpenAI fallback:', elevenErr);
      }
    }

    // Fallback to OpenAI
    if (process.env.OPENAI_API_KEY) {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const mp3 = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'nova',
        input: text,
        response_format: 'mp3',
      });
      const buf = Buffer.from(await mp3.arrayBuffer());
      return new Response(buf, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': buf.length.toString(),
        },
      });
    }

    return NextResponse.json(
      { error: 'No TTS API key configured (ELEVENLABS_API_KEY or OPENAI_API_KEY)' },
      { status: 500 }
    );
  } catch (error) {
    console.error('TTS error:', error);
    const msg = error instanceof Error ? error.message : 'Speech synthesis failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
