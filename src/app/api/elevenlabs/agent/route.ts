import { NextRequest, NextResponse } from 'next/server';
import { createAgent, updateAgent, deleteAgent, getAgent } from '@/lib/elevenlabs/client';
import { buildAgentConfig } from '@/lib/elevenlabs/agent-builder';
import type { Survey } from '@/types/survey';
import { requireAuth } from '@/lib/api/require-auth';
import { log } from '@/lib/log';

/**
 * POST /api/elevenlabs/agent
 * Create an ElevenLabs Conversational AI agent from a survey definition.
 *
 * Intentionally NOT auth-gated: the /test anonymous demo surface must be
 * able to mint an agent so the shared /s/preview link is voice-capable.
 * Cost exposure is bounded by the proxy rate limit and ElevenLabs' own
 * per-account quotas. When we add stricter gating we should gate by an
 * app-specific signal (e.g. a `demoMode` flag tied to the /test origin)
 * rather than a session cookie.
 *
 * Body: { survey: Survey, voiceId?: string }
 * Returns: { agentId: string, agent: object }
 */
export async function POST(req: NextRequest) {
  try {
    const { survey, voiceId } = (await req.json()) as {
      survey: Survey;
      voiceId?: string;
    };

    if (!survey?.elements?.length) {
      return NextResponse.json(
        { error: 'Survey must have at least one element' },
        { status: 400 }
      );
    }

    const config = buildAgentConfig(survey, voiceId);
    const agent = await createAgent(config);

    return NextResponse.json({
      agentId: agent.agent_id,
      agent,
    });
  } catch (error) {
    log.error({
      event: 'elevenlabs.agent.create_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create agent' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/elevenlabs/agent
 * Update an existing agent (e.g., when survey is edited after publishing).
 *
 * Auth-gated.
 *
 * Body: { agentId: string, survey: Survey, voiceId?: string }
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const { agentId, survey, voiceId } = (await req.json()) as {
      agentId: string;
      survey: Survey;
      voiceId?: string;
    };

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    }

    const config = buildAgentConfig(survey, voiceId);
    const agent = await updateAgent(agentId, config);

    return NextResponse.json({ agentId: agent.agent_id, agent });
  } catch (error) {
    log.error({
      event: 'elevenlabs.agent.update_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update agent' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/elevenlabs/agent
 * Delete an ElevenLabs agent.
 *
 * Auth-gated.
 *
 * Body: { agentId: string }
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const { agentId } = (await req.json()) as { agentId: string };
    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    }

    await deleteAgent(agentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({
      event: 'elevenlabs.agent.delete_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete agent' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/elevenlabs/agent?agentId=xxx
 * Get agent details.
 *
 * Auth-gated — owner/admin tool, not a respondent surface.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const agentId = req.nextUrl.searchParams.get('agentId');
    if (!agentId) {
      return NextResponse.json({ error: 'agentId query param required' }, { status: 400 });
    }

    const agent = await getAgent(agentId);
    return NextResponse.json({ agent });
  } catch (error) {
    log.error({
      event: 'elevenlabs.agent.get_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get agent' },
      { status: 500 }
    );
  }
}
