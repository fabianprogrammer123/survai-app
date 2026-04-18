import { z } from 'zod';

// ---------------------------------------------------------------------------
// Blueprint schema — compact agent output referencing block template IDs
// ---------------------------------------------------------------------------

const blueprintBlockSchema = z.object({
  blockId: z.string().describe('Block template ID from the catalog (e.g. "nps_score", "open_feedback")'),
  overrides: z
    .object({
      title: z.string().nullable().optional().describe('Override the default question title'),
      description: z.string().nullable().optional().describe('Override the helper text'),
      required: z.boolean().nullable().optional(),
      options: z.array(z.string()).nullable().optional().describe('Override choice options'),
      placeholder: z.string().nullable().optional(),
      allowOther: z.boolean().nullable().optional(),
      min: z.number().nullable().optional(),
      max: z.number().nullable().optional(),
      minLabel: z.string().nullable().optional(),
      maxLabel: z.string().nullable().optional(),
      mode: z.enum(['discrete', 'continuous']).nullable().optional().describe("Linear-scale display mode: 'discrete' (radio dots) or 'continuous' (slider)"),
      accentColor: z.string().nullable().optional().describe('Hex accent color for this element border'),
      backgroundColor: z.string().nullable().optional().describe('Hex background color for this element card'),
    })
    .nullable()
    .optional()
    .describe('Override default block content. Omit to use template defaults.'),
  rationale: z
    .string()
    .nullable()
    .optional()
    .describe('Brief explanation (1-2 sentences) of why this block was chosen for this survey'),
});

export const surveyBlueprintSchema = z.object({
  title: z.string().describe('Survey title'),
  description: z.string().describe('Short survey description'),
  blocks: z
    .array(blueprintBlockSchema)
    .describe('Ordered list of blocks to include in the survey'),
  settings: z
    .object({
      theme: z.enum(['default', 'minimal', 'bold']).nullable().optional(),
      showProgressBar: z.boolean().nullable().optional(),
      shuffleQuestions: z.boolean().nullable().optional(),
      confirmationMessage: z.string().nullable().optional(),
      backgroundPrompt: z.string().nullable().optional().describe('DALL-E prompt for generating a background image. Keep it abstract and atmospheric.'),
      visualEffect: z.enum(['none', 'gradient-overlay', 'particles', 'glass-morphism', 'aurora']).nullable().optional().describe('CSS visual effect for the survey canvas'),
      fontFamily: z.enum(['inter', 'dm-sans', 'space-grotesk', 'playfair', 'jetbrains-mono']).nullable().optional().describe('Font family for the survey'),
    })
    .nullable()
    .optional()
    .describe('Optional survey settings overrides'),
});

export type SurveyBlueprint = z.infer<typeof surveyBlueprintSchema>;

// ---------------------------------------------------------------------------
// Survey settings (full schema, used for store and validation)
// ---------------------------------------------------------------------------

export const surveySettingsSchema = z.object({
  theme: z.enum(['default', 'minimal', 'bold']),
  showProgressBar: z.boolean(),
  shuffleQuestions: z.boolean(),
  confirmationMessage: z.string(),
});

// ---------------------------------------------------------------------------
// Nullable partial settings — for AI structured outputs (all optional+nullable)
// ---------------------------------------------------------------------------

const nullablePartialSettingsSchema = z.object({
  theme: z.enum(['default', 'minimal', 'bold']).nullable().optional(),
  showProgressBar: z.boolean().nullable().optional(),
  shuffleQuestions: z.boolean().nullable().optional(),
  confirmationMessage: z.string().nullable().optional(),
  backgroundPrompt: z.string().nullable().optional().describe('DALL-E prompt for generating a background image. Keep it abstract and atmospheric.'),
  visualEffect: z.enum(['none', 'gradient-overlay', 'particles', 'glass-morphism', 'aurora']).nullable().optional().describe('CSS visual effect for the survey canvas'),
  fontFamily: z.enum(['inter', 'dm-sans', 'space-grotesk', 'playfair', 'jetbrains-mono']).nullable().optional().describe('Font family for the survey'),
  stylePreset: z.enum(['google-forms', 'typeform']).nullable().optional().describe('Visual preset: google-forms (scroll list) or typeform (one question at a time)'),
  colorMode: z.enum(['light', 'dark']).nullable().optional().describe('Light or dark color mode for the survey'),
  layoutMode: z.enum(['scroll', 'one-at-a-time']).nullable().optional().describe('Layout mode — usually derived from stylePreset, only set explicitly for unusual combinations'),
  aiContext: z.object({
    goal: z.string().nullable().optional(),
    strictness: z.enum(['strict', 'balanced', 'open']).nullable().optional(),
  }).nullable().optional(),
});

// ---------------------------------------------------------------------------
// UI Command schema — flat object for structured outputs compatibility
// ---------------------------------------------------------------------------

// Element update fields — explicit keys for structured outputs compatibility
const elementUpdatesSchema = z.object({
  title: z.string().nullable().optional().describe('New question title'),
  description: z.string().nullable().optional().describe('New helper text'),
  required: z.boolean().nullable().optional(),
  placeholder: z.string().nullable().optional(),
  options: z.array(z.string()).nullable().optional().describe('New choice options'),
  allowOther: z.boolean().nullable().optional(),
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
  minLabel: z.string().nullable().optional(),
  maxLabel: z.string().nullable().optional(),
  mode: z.enum(['discrete', 'continuous']).nullable().optional().describe("Linear-scale display mode"),
  accentColor: z.string().nullable().optional().describe('Hex accent color'),
  backgroundColor: z.string().nullable().optional().describe('Hex background color'),
});

export const uiCommandSchema = z.object({
  action: z.enum([
    'move_element',
    'update_element',
    'delete_element',
    'duplicate_element',
    'update_settings',
    'select_element',
    'publish_survey',
  ]).describe('The command action to perform'),
  elementId: z.string().nullable().optional().describe('ID of the element to act on'),
  toIndex: z.number().nullable().optional().describe('Target position for move_element (0-based)'),
  respondentCount: z.number().nullable().optional().describe('Number of AI respondents for publish_survey (default 25)'),
  updates: elementUpdatesSchema
    .nullable()
    .optional()
    .describe('Partial element fields for update_element'),
  settings: nullablePartialSettingsSchema
    .nullable()
    .optional()
    .describe('Settings for update_settings'),
});

export type UiCommand = z.infer<typeof uiCommandSchema>;

// ---------------------------------------------------------------------------
// AI response — flat object (zodResponseFormat requires root z.object)
// ---------------------------------------------------------------------------

export const aiResponseSchema = z.object({
  intent: z.enum(['generate', 'command', 'clarify', 'propose']).describe(
    'generate = create/replace survey from blueprint; command = surgical edits to existing elements; clarify = ask user for more info — ONLY when request is genuinely impossible to execute; propose = offer 2-3 alternative designs — ONLY when user explicitly asks for alternatives or options'
  ),
  message: z.string().describe('Conversational response to show the user'),
  blueprint: surveyBlueprintSchema
    .nullable()
    .optional()
    .describe('Survey blueprint (required when intent is "generate")'),
  commands: z.array(uiCommandSchema)
    .nullable()
    .optional()
    .describe('UI commands (required when intent is "command")'),
  clarifyingQuestions: z.array(z.object({
    question: z.string().describe('The clarifying question to display to the user'),
    response: z.string().describe('The affirmative response text from the user perspective when they click this suggestion (e.g. "I would like...", "Yes, please include...")'),
  }))
    .nullable()
    .optional()
    .describe('Questions to ask the user for clarification (used with intent: "clarify") — ONLY when request is genuinely impossible to execute'),
  proposals: z.array(z.object({
    label: z.string().describe('Short label for this option, e.g. "Option A: Dropdown" or "Option B: Free text"'),
    description: z.string().nullable().optional().describe('Why this approach works'),
    blueprint: surveyBlueprintSchema.describe('The full blueprint if this option is chosen'),
  }))
    .nullable()
    .optional()
    .describe('Alternative survey designs for the user to pick from, 2-3 options (used with intent: "propose") — ONLY when user explicitly asks for alternatives or options'),
});

export type AiResponse = z.infer<typeof aiResponseSchema>;

// ---------------------------------------------------------------------------
// Per-element-type schemas (optional — used for validation of concrete
// SurveyElement objects, not blueprint hydration).
// ---------------------------------------------------------------------------

export const rankingElementSchema = z.object({
  id: z.string(),
  type: z.literal('ranking'),
  title: z.string(),
  description: z.string().nullable().optional(),
  required: z.boolean(),
  items: z.array(z.string()).min(2),
});
