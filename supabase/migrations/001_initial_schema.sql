-- Surveys table
CREATE TABLE surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Survey',
  description TEXT DEFAULT '',
  schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings JSONB NOT NULL DEFAULT '{
    "theme": "default",
    "showProgressBar": true,
    "shuffleQuestions": false,
    "confirmationMessage": "Thank you for your response!"
  }'::jsonb,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Responses table
CREATE TABLE responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  respondent_metadata JSONB DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat history
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_surveys_user_id ON surveys(user_id);
CREATE INDEX idx_responses_survey_id ON responses(survey_id);
CREATE INDEX idx_chat_messages_survey_id ON chat_messages(survey_id);

-- Row Level Security
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Surveys: owners can CRUD their own
CREATE POLICY "Users can view own surveys"
  ON surveys FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create surveys"
  ON surveys FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own surveys"
  ON surveys FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own surveys"
  ON surveys FOR DELETE USING (auth.uid() = user_id);

-- Published surveys are viewable by anyone (for public survey links)
CREATE POLICY "Anyone can view published surveys"
  ON surveys FOR SELECT USING (published = true);

-- Responses: anyone can submit to published surveys, owners can view
CREATE POLICY "Anyone can submit responses to published surveys"
  ON responses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM surveys
      WHERE surveys.id = responses.survey_id AND surveys.published = true
    )
  );

CREATE POLICY "Survey owners can view responses"
  ON responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM surveys
      WHERE surveys.id = responses.survey_id AND surveys.user_id = auth.uid()
    )
  );

-- Chat messages: survey owners only
CREATE POLICY "Users can manage chat for own surveys"
  ON chat_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM surveys
      WHERE surveys.id = chat_messages.survey_id AND surveys.user_id = auth.uid()
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER surveys_updated_at
  BEFORE UPDATE ON surveys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
