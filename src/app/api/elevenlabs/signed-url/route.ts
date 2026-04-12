import { NextRequest, NextResponse } from 'next/server';
import { getSignedUrl } from '@/lib/elevenlabs/client';

/**
 * GET /api/elevenlabs/signed-url?agentId=xxx
 * Get a signed URL for starting a browser-based ElevenLabs conversation.
 * Signed URLs are valid for 15 minutes.
 */
export async function GET(req: NextRequest) {
  try {
    const agentId = req.nextUrl.searchParams.get('agentId');
    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId query param is required' },
        { status: 400 }
      );
    }

    const { signed_url } = await getSignedUrl(agentId);

    return NextResponse.json({ signedUrl: signed_url });
  } catch (error) {
    console.error('Failed to get signed URL:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get signed URL' },
      { status: 500 }
    );
  }
}
