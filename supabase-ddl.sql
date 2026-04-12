-- =============================================================================
-- Survai — Supabase DDL
-- Run this in the Supabase SQL Editor after creating your project.
-- =============================================================================

-- 1. surveys table
create table if not exists public.surveys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  title         text not null default 'Untitled Survey',
  description   text,
  schema        jsonb not null default '[]'::jsonb,        -- SurveyElement[]
  settings      jsonb not null default '{}'::jsonb,        -- SurveySettings
  published     boolean not null default false,
  published_at  timestamptz,
  agent_id      text,                                      -- ElevenLabs agent ID
  public_url    text,                                      -- Published URL
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger surveys_updated_at
  before update on public.surveys
  for each row execute function public.update_updated_at();

-- RLS
alter table public.surveys enable row level security;

-- Owner can do everything
create policy "Owner full access" on public.surveys
  for all using (auth.uid() = user_id);

-- Anyone can read published surveys (for public survey page)
create policy "Public read published" on public.surveys
  for select using (published = true);


-- 2. responses table
create table if not exists public.responses (
  id            uuid primary key default gen_random_uuid(),
  survey_id     uuid references public.surveys(id) on delete cascade not null,
  answers       jsonb not null default '{}'::jsonb,
  channel       text not null default 'web_form',          -- web_form | web_voice | phone_call
  metadata      jsonb default '{}'::jsonb,                 -- phone number, call duration, etc.
  submitted_at  timestamptz not null default now()
);

alter table public.responses enable row level security;

-- Anyone can insert responses to published surveys
create policy "Insert to published surveys" on public.responses
  for insert with check (
    exists (
      select 1 from public.surveys
      where surveys.id = responses.survey_id and surveys.published = true
    )
  );

-- Survey owner can read responses
create policy "Owner reads responses" on public.responses
  for select using (
    exists (
      select 1 from public.surveys
      where surveys.id = responses.survey_id and surveys.user_id = auth.uid()
    )
  );

-- Service role (webhooks) can insert any response — handled by service role key bypassing RLS


-- 3. chat_messages table (AI chat history per survey)
create table if not exists public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  survey_id     uuid references public.surveys(id) on delete cascade not null,
  role          text not null,                              -- user | assistant | system
  content       text not null,
  metadata      jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "Owner manages chat" on public.chat_messages
  for all using (
    exists (
      select 1 from public.surveys
      where surveys.id = chat_messages.survey_id and surveys.user_id = auth.uid()
    )
  );


-- 4. guests table (invited respondents with personalized links)
create table if not exists public.guests (
  id          uuid primary key default gen_random_uuid(),
  survey_id   uuid references public.surveys(id) on delete cascade not null,
  name        text not null,
  email       text,
  phone       text,
  token       text unique not null,           -- short invite token for personalized URL
  status      text not null default 'invited', -- invited | started | completed
  response_id uuid references public.responses(id) on delete set null,
  profile     jsonb,                           -- AI-generated guest profile summary
  created_at  timestamptz not null default now()
);

alter table public.guests enable row level security;

-- Survey owner manages guests
create policy "Owner manages guests" on public.guests
  for all using (
    exists (
      select 1 from public.surveys
      where surveys.id = guests.survey_id and surveys.user_id = auth.uid()
    )
  );

-- Public can read own guest record by token (for personalized survey page)
create policy "Public read by token" on public.guests
  for select using (true);  -- Token lookup is filtered in application layer

-- Service role can update guest status from webhooks
-- (handled by service role key bypassing RLS)


-- 5. Indexes for performance
create index if not exists idx_surveys_user_id on public.surveys(user_id);
create index if not exists idx_surveys_agent_id on public.surveys(agent_id) where agent_id is not null;
create index if not exists idx_responses_survey_id on public.responses(survey_id);
create index if not exists idx_chat_messages_survey_id on public.chat_messages(survey_id);
create index if not exists idx_guests_survey_id on public.guests(survey_id);
create index if not exists idx_guests_token on public.guests(token);
