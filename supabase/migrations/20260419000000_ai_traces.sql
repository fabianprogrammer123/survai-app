-- =============================================================================
-- 20260419000000_ai_traces
-- Per-turn AI trace rows for the chat/creator agent: what model was called,
-- which intent it classified, how long it took, how many tokens it used,
-- plus a truncated sample of the raw response for debugging.
--
-- Consumed by the "AI Inspector" drawer in the survey editor to give
-- creators visibility into what the agent is doing at each step, and to
-- back future fine-tuning decisions (model switch, temperature, etc.).
--
-- Idempotent: re-runnable safely.
-- =============================================================================

create table if not exists public.ai_traces (
  id                   uuid primary key default gen_random_uuid(),
  -- Nullable so the anonymous /test/edit flow (no Supabase survey row) can
  -- still emit traces. Authenticated flows set it to the survey being edited.
  survey_id            uuid references public.surveys(id) on delete cascade,
  -- Chat-turn index within this survey session. 0-based. Kept informational;
  -- not unique, because a single turn can produce multiple traces (e.g.,
  -- background image generation after a generate intent).
  turn_index           integer not null default 0,
  user_message         text,
  -- Allowed values: generate | propose | command | clarify | error | results.
  -- Not a pg enum so we can widen cheaply when new intents appear.
  intent               text,
  model                text,
  system_prompt_hash   text,
  system_prompt_head   text,
  duration_ms          integer,
  input_tokens         integer,
  output_tokens        integer,
  proposals_count      integer,
  commands             jsonb,
  raw_response_sample  text,
  error                text,
  created_at           timestamptz not null default now()
);

-- Fast lookup by survey for the inspector UI (most recent first).
create index if not exists ai_traces_survey_created_idx
  on public.ai_traces (survey_id, created_at desc);

-- Fast lookup for the anon /test flow cleanup job (oldest-first). We don't
-- ship a cleanup job now, but the /test rows are low-value and should be
-- prunable without a full scan.
create index if not exists ai_traces_anon_created_idx
  on public.ai_traces (created_at)
  where survey_id is null;

alter table public.ai_traces enable row level security;

-- Authenticated owners can read/write their own surveys' traces.
drop policy if exists "Owner manages traces" on public.ai_traces;
create policy "Owner manages traces" on public.ai_traces
  for all
  using (
    exists (
      select 1 from public.surveys
      where surveys.id = ai_traces.survey_id
        and surveys.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.surveys
      where surveys.id = ai_traces.survey_id
        and surveys.user_id = auth.uid()
    )
  );

-- Anonymous /test flow can INSERT rows with survey_id IS NULL only.
-- This is an intentional write-only firehose for the public demo path.
-- Rate limiting is handled upstream (Stream C); this table does not expose
-- PII and is append-only from the anon side.
drop policy if exists "Anon insert trace for test flow" on public.ai_traces;
create policy "Anon insert trace for test flow" on public.ai_traces
  for insert
  to anon
  with check (survey_id is null);
