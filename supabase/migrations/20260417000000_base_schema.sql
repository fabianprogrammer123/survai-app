-- =============================================================================
-- 20260417000000_base_schema
-- Canonical baseline schema for Survai. Applied to project shgsuahugiiuyopwyxtp
-- on 2026-04-17 via Supabase MCP. Replaces both the prior root-level
-- supabase-ddl.sql and the older supabase/migrations/001_initial_schema.sql
-- (which was missing the guests table and published_at/agent_id/public_url cols).
--
-- Idempotent: re-runnable safely (CREATE TABLE IF NOT EXISTS for tables,
-- DROP-then-CREATE for policies/triggers).
-- =============================================================================

create table if not exists public.surveys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  title         text not null default 'Untitled Survey',
  description   text,
  schema        jsonb not null default '[]'::jsonb,
  settings      jsonb not null default '{}'::jsonb,
  published     boolean not null default false,
  published_at  timestamptz,
  agent_id      text,
  public_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists surveys_updated_at on public.surveys;
create trigger surveys_updated_at
  before update on public.surveys
  for each row execute function public.update_updated_at();

alter table public.surveys enable row level security;

drop policy if exists "Owner full access" on public.surveys;
create policy "Owner full access" on public.surveys
  for all using (auth.uid() = user_id);

drop policy if exists "Public read published" on public.surveys;
create policy "Public read published" on public.surveys
  for select using (published = true);

create table if not exists public.responses (
  id            uuid primary key default gen_random_uuid(),
  survey_id     uuid references public.surveys(id) on delete cascade not null,
  answers       jsonb not null default '{}'::jsonb,
  channel       text not null default 'web_form',
  metadata      jsonb default '{}'::jsonb,
  submitted_at  timestamptz not null default now()
);

alter table public.responses enable row level security;

drop policy if exists "Insert to published surveys" on public.responses;
create policy "Insert to published surveys" on public.responses
  for insert with check (
    exists (
      select 1 from public.surveys
      where surveys.id = responses.survey_id and surveys.published = true
    )
  );

drop policy if exists "Owner reads responses" on public.responses;
create policy "Owner reads responses" on public.responses
  for select using (
    exists (
      select 1 from public.surveys
      where surveys.id = responses.survey_id and surveys.user_id = auth.uid()
    )
  );

create table if not exists public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  survey_id     uuid references public.surveys(id) on delete cascade not null,
  role          text not null,
  content       text not null,
  metadata      jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

drop policy if exists "Owner manages chat" on public.chat_messages;
create policy "Owner manages chat" on public.chat_messages
  for all using (
    exists (
      select 1 from public.surveys
      where surveys.id = chat_messages.survey_id and surveys.user_id = auth.uid()
    )
  );

create table if not exists public.guests (
  id          uuid primary key default gen_random_uuid(),
  survey_id   uuid references public.surveys(id) on delete cascade not null,
  name        text not null,
  email       text,
  phone       text,
  token       text unique not null,
  status      text not null default 'invited',
  response_id uuid references public.responses(id) on delete set null,
  profile     jsonb,
  created_at  timestamptz not null default now()
);

alter table public.guests enable row level security;

drop policy if exists "Owner manages guests" on public.guests;
create policy "Owner manages guests" on public.guests
  for all using (
    exists (
      select 1 from public.surveys
      where surveys.id = guests.survey_id and surveys.user_id = auth.uid()
    )
  );

drop policy if exists "Public read by token" on public.guests;
create policy "Public read by token" on public.guests
  for select using (true);

create index if not exists idx_surveys_user_id on public.surveys(user_id);
create index if not exists idx_surveys_agent_id on public.surveys(agent_id) where agent_id is not null;
create index if not exists idx_responses_survey_id on public.responses(survey_id);
create index if not exists idx_chat_messages_survey_id on public.chat_messages(survey_id);
create index if not exists idx_guests_survey_id on public.guests(survey_id);
create index if not exists idx_guests_token on public.guests(token);
