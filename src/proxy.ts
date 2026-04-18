import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { log } from '@/lib/log';
import { assertServerEnv } from '@/lib/env';
import {
  check as checkRateLimit,
  getClientIp,
  isBypassed as isRateLimitBypassed,
  ruleFor as rateLimitRuleFor,
} from '@/lib/api/rate-limit';

// Fail-fast on misconfigured production revisions. No-op in dev.
// Runs at module load (= first cold start in serverless).
assertServerEnv();

/**
 * Next.js 16 proxy (formerly middleware). Two responsibilities:
 *   1. Refresh Supabase auth session cookies on every request (so server
 *      components see fresh user state).
 *   2. Gate protected paths — anon users hitting /dashboard or /survey/[id]/*
 *      get bounced to /login?next=<original-path>.
 *
 * Public paths (no gating, but still session-refreshed):
 *   - /, /test, /admin (in-product try-before-signup surfaces)
 *   - /s/* (respondent surface — must work for anon)
 *   - /login, /signup, /auth/* (auth surfaces)
 *   - /api/ai/* (AI proxy routes — handle their own auth)
 *   - /api/surveys/[id]/submit (anon respondent submit)
 *   - /api/webhooks/* (webhook receivers)
 *   - /api/elevenlabs/* (voice agent provisioning — handles its own auth)
 */

const PUBLIC_PREFIXES = [
  '/test',
  '/admin',
  '/s/',
  '/login',
  '/signup',
  '/auth/',
  '/api/ai',
  '/api/webhooks',
  '/api/elevenlabs',
];

const PROTECTED_PREFIXES = ['/dashboard', '/survey/'];

function isProtected(path: string) {
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p));
}

function isPublic(path: string) {
  if (path === '/') return true;
  // /api/surveys/[id]/submit is anon (respondent submit) — everything else
  // under /api/surveys/* is owner-gated by the route handlers themselves.
  if (/^\/api\/surveys\/[^/]+\/submit\/?$/.test(path)) return true;
  return PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

export async function proxy(request: NextRequest) {
  // Without Supabase env, allow everything through (local dev w/o backend)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;

  // Rate-limit /api/* requests BEFORE the public fast-path so anon
  // routes (chat demo, submit) are still throttled. Webhooks and health
  // are exempt — third-party-origin and infrastructure-origin traffic
  // should not share the abuse budget.
  if (path.startsWith('/api/') && !isRateLimitBypassed(path)) {
    const ip = getClientIp(request);
    const rule = rateLimitRuleFor(path);
    const result = checkRateLimit(`${path}|${ip}`, rule);
    if (!result.ok) {
      const retryAfterSec = Math.max(1, Math.ceil(result.resetMs / 1000));
      log.warn({
        event: 'rate_limit.exceeded',
        path,
        ip,
        limit: result.limit,
        retryAfterSec,
      });
      return NextResponse.json(
        { error: 'Too many requests', code: 'rate_limited' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSec),
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(
              Math.ceil((Date.now() + result.resetMs) / 1000)
            ),
          },
        }
      );
    }
  }

  // Fast-path: public, no auth check needed (but session refresh is fine to skip)
  if (isPublic(path)) {
    return NextResponse.next();
  }

  // Build response with cookie-mirroring so Supabase can refresh the session
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Protected path + no user = redirect to /login?next=<original>
  if (isProtected(path) && !user) {
    const loginUrl = new URL('/login', request.url);
    const fullPath = path + request.nextUrl.search;
    loginUrl.searchParams.set('next', fullPath);
    log.info({
      event: 'auth.gate_redirect',
      path,
      reason: 'no_session',
    });
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
