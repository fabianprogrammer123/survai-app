import { z } from 'zod';

/**
 * POST /api/surveys — request body. All fields optional; defaults
 * applied server-side. The dashboard "New Survey" button posts an
 * empty body; the /claim-draft flow posts title+description+schema+
 * settings to migrate a localStorage draft in one insert.
 */
export const createSurveyRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  /** Full element list from the local draft. Shape is validated by the store. */
  schema: z.array(z.unknown()).optional(),
  /** Survey settings from the local draft. */
  settings: z.record(z.string(), z.unknown()).optional(),
});

export type CreateSurveyRequest = z.infer<typeof createSurveyRequestSchema>;

/**
 * Survey row exposed to the client. Mirrors DB column names (snake_case)
 * for compatibility with existing dashboard / editor code that reads
 * `created_at` / `updated_at` directly.
 */
export const surveyRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  schema: z.array(z.unknown()),
  settings: z.record(z.string(), z.unknown()),
  published: z.boolean(),
  published_at: z.string().nullable(),
  agent_id: z.string().nullable(),
  public_url: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type SurveyRow = z.infer<typeof surveyRowSchema>;
