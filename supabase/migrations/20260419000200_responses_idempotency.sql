-- =============================================================================
-- 20260419000200_responses_idempotency
-- Webhook idempotency guard for public.responses.
--
-- ElevenLabs may retry post-call webhooks (e.g., on a 5xx from our side),
-- and a misconfigured ElevenLabs agent can fire multiple deliveries for
-- the same conversation. Without a constraint, each retry inserts a new
-- responses row — survey owners then see duplicate answers.
--
-- This migration adds a partial UNIQUE index on the conversationId pulled
-- out of the metadata JSON. The index is partial (WHERE ... IS NOT NULL)
-- so that form-submitted responses (no conversationId) are unaffected.
--
-- The webhook handler follows a check-then-insert pattern and uses the
-- '23505' unique_violation code as the race-condition backstop. Both paths
-- converge on a single row per conversationId.
-- =============================================================================

create unique index if not exists responses_conversation_id_unique
  on public.responses ((metadata->>'conversationId'))
  where metadata->>'conversationId' is not null;
