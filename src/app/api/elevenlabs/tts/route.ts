import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech } from '@/lib/elevenlabs/client';

/**
 * POST /api/elevenlabs/tts
 * Text-to-speech using ElevenLabs (replaces OpenAI TTS).
 *
 * Body: { text: string, voiceId?: string }
 * Returns: audio/mpeg stream
 */
export async function POST(req: NextRequest) {
  try {
    const { text, voiceId } = (await req.json()) as {
      text: string;
      voiceId?: string;
    };

    if (!text?.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    // Limit text length to avoid excessive costs
    const trimmed = text.slice(0, 5000);

    const audioBuffer = await synthesizeSpeech(trimmed, voiceId);

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
      },
    });
  } catch (error) {
    console.error('ElevenLabs TTS error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'TTS synthesis failed' },
      { status: 500 }
    );
  }
}
