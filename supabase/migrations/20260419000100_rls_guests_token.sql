-- =============================================================================
-- 20260419000100_rls_guests_token
-- Tighten RLS on public.guests.
--
-- Before: the "Public read by token" policy used `using (true)`, which let
-- any caller holding the Supabase anon key SELECT every row in the guests
-- table (tokens, names, emails, phone numbers, and profile JSON). The
-- "token" in the policy name was aspirational — the policy never actually
-- checked one.
--
-- After: the policy is removed. The legitimate unauthenticated read path
-- is the server route GET /api/surveys/[id]/guests/[token], which uses
-- the service-role client (bypasses RLS) and validates the token itself.
-- A grep across `src/` confirmed no browser code calls .from('guests') —
-- every access is server-side and already either:
--   (a) owner-authenticated (owner RLS policy still applies), or
--   (b) service-role client (RLS bypassed regardless).
--
-- The "Owner manages guests" policy is preserved untouched. An owner
-- can still SELECT/INSERT/UPDATE/DELETE their survey's guests.
--
-- Goal: `curl $SUPABASE_URL/rest/v1/guests?select=*` with only the anon
-- key MUST return an empty array, not a dump of every token.
-- =============================================================================

drop policy if exists "Public read by token" on public.guests;

-- Idempotency: re-running should leave only the owner policy in place.
-- The owner policy is untouched.
