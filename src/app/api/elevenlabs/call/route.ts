import { NextRequest, NextResponse } from 'next/server';
import { makeOutboundCall, getConversation } from '@/lib/elevenlabs/client';

/**
 * POST /api/elevenlabs/call
 * Initiate a single outbound phone call for a survey.
 *
 * Body: { agentId: string, phoneNumberId: string, toNumber: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { agentId, phoneNumberId, toNumber } = (await req.json()) as {
      agentId: string;
      phoneNumberId: string;
      toNumber: string;
    };

    if (!agentId || !phoneNumberId || !toNumber) {
      return NextResponse.json(
        { error: 'agentId, phoneNumberId, and toNumber are required' },
        { status: 400 }
      );
    }

    // Validate phone number format (E.164)
    if (!/^\+[1-9]\d{1,14}$/.test(toNumber)) {
      return NextResponse.json(
        { error: 'Phone number must be in E.164 format (e.g., +14155551234)' },
        { status: 400 }
      );
    }

    const result = await makeOutboundCall({
      agent_id: agentId,
      agent_phone_number_id: phoneNumberId,
      to_number: toNumber,
    });

    return NextResponse.json({
      callId: result.call_id,
      status: result.status,
    });
  } catch (error) {
    console.error('Failed to make outbound call:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to make call' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/elevenlabs/call?conversationId=xxx
 * Get conversation details (transcript + extracted data).
 */
export async function GET(req: NextRequest) {
  try {
    const conversationId = req.nextUrl.searchParams.get('conversationId');
    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId query param is required' },
        { status: 400 }
      );
    }

    const conversation = await getConversation(conversationId);

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('Failed to get conversation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get conversation' },
      { status: 500 }
    );
  }
}
