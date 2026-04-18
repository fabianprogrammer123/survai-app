import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech } from '@/lib/elevenlabs/client';
import { requireAuth } from '@/lib/api/require-auth';
import { log } from '@/lib/log';

/**
 * POST /api/elevenlabs/tts
 * Text-to-speech using ElevenLabs (replaces OpenAI TTS).
 *
 * Auth-gated: per-character ElevenLabs cost. Respondent-side voice uses the
 * signed-url flow (browser WebRTC), not this endpoint.
 *
 * Body: { text: string, voiceId?: string }
 * Returns: audio/mpeg stream
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

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
    log.error({
      event: 'elevenlabs.tts.failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'TTS synthesis failed' },
      { status: 500 }
    );
  }
}
