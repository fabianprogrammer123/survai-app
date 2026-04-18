import type { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { unauthorized } from './errors';

/**
 * Standard auth gate for server routes.
 *
 *   const auth = await requireAuth();
 *   if (auth instanceof Response) return auth;
 *   const { user } = auth;
 *
 * Uses the cookie-backed Supabase server client. The proxy refreshes the
 * session cookie on every request, so this is a cheap lookup.
 *
 * The `_req` parameter is accepted for callers that want a symmetric
 * signature with other middleware-style helpers; it is unused today.
 */
export async function requireAuth(
  _req?: NextRequest
): Promise<{ user: User } | Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return unauthorized();
  }
  return { user: data.user };
}
