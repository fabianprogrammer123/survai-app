import { z } from 'zod';

export const elementTypeSchema = z.enum([
  'short_text',
  'long_text',
  'multiple_choice',
  'checkboxes',
  'dropdown',
  'linear_scale',
  'date',
  'file_upload',
  'section_header',
  'page_break',
]);

const baseFields = {
  id: z.string().describe('Unique element ID in format el_XXXXXXXX'),
  title: z.string().describe('The question or section title'),
  description: z.string().optional().describe('Optional helper text below the title'),
  required: z.boolean().describe('Whether this question must be answered'),
};

const shortTextSchema = z.object({
  ...baseFields,
  type: z.literal('short_text'),
  placeholder: z.string().optional(),
});

const longTextSchema = z.object({
  ...baseFields,
  type: z.literal('long_text'),
  placeholder: z.string().optional(),
});

const multipleChoiceSchema = z.object({
  ...baseFields,
  type: z.literal('multiple_choice'),
  options: z.array(z.string()).min(2),
  allowOther: z.boolean().optional(),
});

const checkboxesSchema = z.object({
  ...baseFields,
  type: z.literal('checkboxes'),
  options: z.array(z.string()).min(2),
  allowOther: z.boolean().optional(),
});

const dropdownSchema = z.object({
  ...baseFields,
  type: z.literal('dropdown'),
  options: z.array(z.string()).min(2),
});

const linearScaleSchema = z.object({
  ...baseFields,
  type: z.literal('linear_scale'),
  min: z.number(),
  max: z.number(),
  minLabel: z.string().optional(),
  maxLabel: z.string().optional(),
});

const dateSchema = z.object({
  ...baseFields,
  type: z.literal('date'),
});

const fileUploadSchema = z.object({
  ...baseFields,
  type: z.literal('file_upload'),
  maxFiles: z.number().optional(),
  acceptedTypes: z.array(z.string()).optional(),
});

const sectionHeaderSchema = z.object({
  ...baseFields,
  type: z.literal('section_header'),
});

const pageBreakSchema = z.object({
  ...baseFields,
  type: z.literal('page_break'),
});

export const surveyElementSchema = z.discriminatedUnion('type', [
  shortTextSchema,
  longTextSchema,
  multipleChoiceSchema,
  checkboxesSchema,
  dropdownSchema,
  linearScaleSchema,
  dateSchema,
  fileUploadSchema,
  sectionHeaderSchema,
  pageBreakSchema,
]);

export const surveySettingsSchema = z.object({
  theme: z.enum(['default', 'minimal', 'bold']),
  showProgressBar: z.boolean(),
  shuffleQuestions: z.boolean(),
  confirmationMessage: z.string(),
});

export const aiResponseSchema = z.object({
  message: z.string().describe('Conversational response to show the user'),
  survey: z.object({
    title: z.string(),
    description: z.string(),
    elements: z.array(surveyElementSchema),
    settings: surveySettingsSchema,
  }).describe('The complete updated survey structure'),
});

export type AiResponse = z.infer<typeof aiResponseSchema>;
