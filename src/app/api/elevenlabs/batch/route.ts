import { NextRequest, NextResponse } from 'next/server';
import { submitBatchCalls, getBatchCallStatus } from '@/lib/elevenlabs/client';
import type { BatchCallRecipient } from '@/lib/elevenlabs/types';
import { requireAuth } from '@/lib/api/require-auth';
import { log } from '@/lib/log';

/**
 * POST /api/elevenlabs/batch
 * Submit a batch of outbound phone calls for a survey campaign.
 *
 * Auth-gated: high-cost route (batch telephony).
 *
 * Body: {
 *   name: string,
 *   agentId: string,
 *   phoneNumberId: string,
 *   recipients: { phone_number: string, name?: string }[],
 *   scheduledTime?: number  // Unix timestamp
 * }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const body = (await req.json()) as {
      name: string;
      agentId: string;
      phoneNumberId: string;
      recipients: BatchCallRecipient[];
      scheduledTime?: number;
    };

    if (!body.agentId || !body.phoneNumberId) {
      return NextResponse.json(
        { error: 'agentId and phoneNumberId are required' },
        { status: 400 }
      );
    }

    if (!body.recipients?.length) {
      return NextResponse.json(
        { error: 'At least one recipient is required' },
        { status: 400 }
      );
    }

    // Validate all phone numbers are E.164
    const invalid = body.recipients.filter(
      (r) => !/^\+[1-9]\d{1,14}$/.test(r.phone_number)
    );
    if (invalid.length > 0) {
      return NextResponse.json(
        {
          error: `${invalid.length} phone number(s) are not in E.164 format. Example: +14155551234`,
          invalidNumbers: invalid.map((r) => r.phone_number),
        },
        { status: 400 }
      );
    }

    const result = await submitBatchCalls({
      name: body.name || 'Survey Campaign',
      agent_id: body.agentId,
      agent_phone_number_id: body.phoneNumberId,
      recipients: body.recipients,
      scheduled_time_unix: body.scheduledTime,
    });

    return NextResponse.json({
      batchId: result.batch_call_id,
      status: result.status,
    });
  } catch (error) {
    log.error({
      event: 'elevenlabs.batch.submit_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit batch calls' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/elevenlabs/batch?batchId=xxx
 * Get batch call status.
 *
 * Auth-gated.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const batchId = req.nextUrl.searchParams.get('batchId');
    if (!batchId) {
      return NextResponse.json(
        { error: 'batchId query param is required' },
        { status: 400 }
      );
    }

    const result = await getBatchCallStatus(batchId);

    return NextResponse.json({
      batchId: result.batch_call_id,
      status: result.status,
      name: result.name,
    });
  } catch (error) {
    log.error({
      event: 'elevenlabs.batch.status_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get batch status' },
      { status: 500 }
    );
  }
}
