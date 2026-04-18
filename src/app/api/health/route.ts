import { NextResponse } from 'next/server';

/**
 * Minimal liveness probe. No external calls — just confirms the process
 * is up and responding. Targets: Cloud Run startup probe, uptime monitors,
 * load balancer health checks.
 *
 * For a deeper readiness check (Supabase reachable? OpenAI key valid?)
 * see /api/ai/health.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
    // K_REVISION is set by Cloud Run; falls back to 'local' in dev.
    version: process.env.K_REVISION ?? 'local',
  });
}
