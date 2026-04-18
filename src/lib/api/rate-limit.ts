import type { NextRequest } from 'next/server';

/**
 * In-memory per-IP sliding-window rate limiter.
 *
 * Scope and caveats:
 *   - State lives in a Map inside this module. On Cloud Run with
 *     min-instances=0, every cold start resets the counters, so a bursty
 *     attacker can pause 15 minutes and refill their quota. That is an
 *     acceptable tradeoff for v1; moving to Redis is called out in
 *     SECURITY.md as a follow-up when we run more than one instance.
 *   - Works per-process. Multi-instance deployments will each track
 *     their own counters; treat the configured limits as a per-instance
 *     soft ceiling, not a hard global.
 *
 * We key on IP (cheap, no auth lookup required). User-session keying
 * would need a Supabase round-trip for every /api/* request, which is
 * worse than letting authenticated users share their IP's quota.
 */

const MAX_KEYS = 5_000;

type Bucket = { timestamps: number[] };
const buckets: Map<string, Bucket> = new Map();

export type RateLimitRule = { windowMs: number; limit: number };
export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  limit: number;
  resetMs: number;
};

export function check(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  const windowStart = now - rule.windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= MAX_KEYS) {
      // Evict the least-recently-inserted / least-recently-refreshed key.
      // Map iteration order is insertion order; we keep it LRU by delete+
      // re-insert on touch below.
      const firstKey = buckets.keys().next().value;
      if (firstKey !== undefined) buckets.delete(firstKey);
    }
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  } else {
    // Refresh LRU order.
    buckets.delete(key);
    buckets.set(key, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= rule.limit) {
    const oldest = bucket.timestamps[0] ?? now;
    const resetMs = Math.max(0, oldest + rule.windowMs - now);
    return {
      ok: false,
      remaining: 0,
      limit: rule.limit,
      resetMs,
    };
  }

  bucket.timestamps.push(now);
  return {
    ok: true,
    remaining: rule.limit - bucket.timestamps.length,
    limit: rule.limit,
    resetMs: rule.windowMs,
  };
}

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    // x-forwarded-for is a comma-separated list; the left-most entry is
    // the original client. Cloud Run strips spoofed values at the LB.
    return xff.split(',')[0]!.trim();
  }
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

// Routes exempt from rate limiting.
// - /api/health: Cloud Run health probe hammers this by design.
// - /api/webhooks: third-party origin with its own retry policy; HMAC
//   already gates abuse.
const BYPASS_PREFIXES = ['/api/health', '/api/webhooks/'];

export function isBypassed(path: string): boolean {
  return BYPASS_PREFIXES.some((p) => path === p || path.startsWith(p));
}

const HOUR = 60 * 60 * 1000;

/**
 * Returns the rate-limit rule for a given request path.
 * Match order is specific-first; fallback is the default anon limit.
 */
export function ruleFor(path: string): RateLimitRule {
  // Cost-engine routes — tight ceilings regardless of auth state (they're
  // also auth-gated by requireAuth, so anon callers never reach these
  // limits in practice; these apply to authenticated users).
  if (path === '/api/ai/responses' || path.startsWith('/api/ai/responses/')) {
    return { windowMs: HOUR, limit: 10 };
  }
  if (path.startsWith('/api/elevenlabs/batch')) {
    return { windowMs: HOUR, limit: 5 };
  }
  if (path.startsWith('/api/elevenlabs/call')) {
    return { windowMs: HOUR, limit: 20 };
  }
  if (path.startsWith('/api/ai/image')) {
    return { windowMs: HOUR, limit: 30 };
  }
  if (path.startsWith('/api/elevenlabs/tts')) {
    return { windowMs: HOUR, limit: 60 };
  }
  if (path.startsWith('/api/ai/chat')) {
    // /test anon chat — the demo surface. A browser that holds a
    // chat open will easily send 50+ messages per hour per user;
    // this is the anon ceiling for the abuse case.
    return { windowMs: HOUR, limit: 200 };
  }

  // Default: 100 req / hour / IP across all other /api/* routes.
  return { windowMs: HOUR, limit: 100 };
}
