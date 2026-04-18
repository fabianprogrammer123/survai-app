import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function resolveEnv(name: string, devFallback: string): string {
  const v = process.env[name];
  if (v) return v;
  // In production, fail loud. In dev, use the fallback so a half-configured
  // local environment still renders pages.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required env var in production: ${name}`);
  }
  return devFallback;
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    resolveEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321'),
    resolveEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'placeholder-key'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}

/**
 * Service-role client for server-to-server operations (webhooks, background jobs).
 * Bypasses RLS — use with care.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createSupabaseClient(url, serviceKey);
}
