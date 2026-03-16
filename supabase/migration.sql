-- Migration: Adapt new Supabase instance for voice-matcher
-- The guest_profiles table already exists with rich LinkedIn data.
-- We add survey-specific columns and create the remaining tables.

-- 1. Add survey columns to guest_profiles
ALTER TABLE guest_profiles
  ADD COLUMN IF NOT EXISTS slug        text UNIQUE,
  ADD COLUMN IF NOT EXISTS password    text,
  ADD COLUMN IF NOT EXISTS survey_completed boolean NOT NULL DEFAULT false;

-- 2. Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  text                 text NOT NULL,
  is_active            boolean NOT NULL DEFAULT true,
  previous_question_id uuid REFERENCES questions(id)
);

-- 3. Create responses table (FK points to guest_profiles)
CREATE TABLE IF NOT EXISTS responses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  participant_id  uuid NOT NULL REFERENCES guest_profiles(id),
  transcript      text NOT NULL DEFAULT '',
  conversation_id text
);

-- One response per participant
CREATE UNIQUE INDEX IF NOT EXISTS responses_participant_id_unique
  ON responses(participant_id);

-- 4. Create response_answers table
CREATE TABLE IF NOT EXISTS response_answers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES responses(id),
  question_id uuid NOT NULL REFERENCES questions(id),
  answer_text text NOT NULL DEFAULT ''
);
