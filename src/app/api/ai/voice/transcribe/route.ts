import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Placeholder lets `next build` succeed when OPENAI_API_KEY is only a
// runtime secret. Handlers guard before making real calls.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'build-placeholder',
});

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    console.error('Transcription error:', error);
    const msg = error instanceof Error ? error.message : 'Transcription failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
