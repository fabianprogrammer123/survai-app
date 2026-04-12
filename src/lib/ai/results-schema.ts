import { z } from 'zod';

/**
 * Schema for bar/pie chart data items.
 */
const chartDataItemSchema = z.object({
  label: z.string(),
  value: z.number(),
});

/**
 * Schema for histogram data items.
 */
const histogramDataItemSchema = z.object({
  label: z.string(),
  count: z.number(),
});

/**
 * Schema for stat grid items.
 */
const statItemSchema = z.object({
  label: z.string(),
  value: z.string(),
  trend: z.string().nullable().optional(),
});

/**
 * Schema for text list items.
 */
const textListItemSchema = z.object({
  text: z.string(),
  count: z.number().nullable().optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).nullable().optional(),
});

/**
 * A2UI component definition that the AI generates.
 * Uses the flat adjacency-list format from A2UI spec.
 */
const a2uiComponentSchema = z.object({
  id: z.string(),
  componentType: z.string(),
  props: z.record(z.string(), z.unknown()),
  children: z.array(z.string()).nullable().optional(),
  weight: z.number().nullable().optional(),
});

/**
 * Full response schema from the results analysis AI.
 */
export const resultsResponseSchema = z.object({
  /** Conversational message to the user explaining the analysis. */
  message: z.string(),
  /** A2UI components describing the dashboard layout. */
  components: z.array(a2uiComponentSchema),
});

export type ResultsResponse = z.infer<typeof resultsResponseSchema>;
export type A2UIComponentDef = z.infer<typeof a2uiComponentSchema>;
