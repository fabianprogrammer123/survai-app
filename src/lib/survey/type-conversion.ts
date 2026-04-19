import { ElementType, SurveyElement } from '@/types/survey';
import { CATALOG } from '@/lib/survey/catalog';

/**
 * Answerable element types — hidden/layout types (section_header, page_break)
 * are not offered as conversion targets.
 */
export const QUESTION_TYPES = CATALOG.filter(
  (c) => c.category !== 'layout' && !c.hidden
);

/**
 * Pull a clean `string[]` out of a source's `options` field, which can be
 * `string[]` (choice types) or `{ label: string; imageDataUrl?: string }[]`
 * (image_choice). Returns undefined when there are no usable values, so
 * callers can fall back through a chain of candidates.
 */
function extractStringOptions(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: string[] = [];
  for (const o of raw) {
    if (typeof o === 'string') out.push(o);
    else if (o && typeof o === 'object' && 'label' in o && typeof (o as { label: unknown }).label === 'string') {
      out.push((o as { label: string }).label);
    }
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Build an updates patch that converts `source` to `targetType`, carrying
 * compatible fields forward and seeding sensible defaults for fields that
 * only exist on the new type. Mirrors the logic that previously lived in
 * the properties panel so the chat's icon-driven type picker produces
 * identical results.
 */
export function buildTypeConversion(
  source: SurveyElement,
  targetType: ElementType
): Partial<SurveyElement> {
  const updates: Record<string, unknown> = { type: targetType };
  const choiceTypes: ElementType[] = ['multiple_choice', 'checkboxes', 'dropdown'];

  if (choiceTypes.includes(targetType)) {
    const src = source as unknown as Record<string, unknown>;
    // Carry concrete values forward in this priority: existing options,
    // ranking items, matrix/likert rows. Falls back to a clearly-labelled
    // placeholder only when none are available.
    const stringOpts =
      extractStringOptions(src.options) ??
      (src.items as string[] | undefined) ??
      (src.rows as string[] | undefined);
    updates.options =
      stringOpts && stringOpts.length > 0
        ? stringOpts
        : ['Option 1', 'Option 2', 'Option 3'];
  } else if (targetType !== 'image_choice') {
    updates.options = undefined;
    updates.allowOther = undefined;
  }

  if (targetType === 'linear_scale') {
    const src = source as unknown as Record<string, unknown>;
    updates.min = src.min ?? 1;
    updates.max = src.max ?? 5;
    updates.minLabel = src.minLabel ?? 'Low';
    updates.maxLabel = src.maxLabel ?? 'High';
  } else if (targetType === 'nps') {
    const src = source as unknown as Record<string, unknown>;
    updates.minLabel = src.minLabel ?? 'Not likely';
    updates.maxLabel = src.maxLabel ?? 'Very likely';
    updates.min = undefined;
    updates.max = undefined;
  } else if (targetType === 'slider') {
    const src = source as unknown as Record<string, unknown>;
    updates.min = src.min ?? 0;
    updates.max = src.max ?? 100;
    updates.step = src.step ?? 1;
    updates.unit = src.unit ?? '%';
    updates.minLabel = src.minLabel;
    updates.maxLabel = src.maxLabel;
  } else if (targetType === 'matrix_single' || targetType === 'matrix_multi') {
    const src = source as unknown as Record<string, unknown>;
    // Prefer rows → items → options (in that order) so switching from a
    // choice/ranking element carries the concrete values forward as
    // statements to rate, rather than wiping to generic "Statement 1..."
    const srcOptions = extractStringOptions(src.options);
    updates.rows =
      (src.rows as string[]) ??
      (src.items as string[]) ??
      srcOptions ??
      ['Statement 1', 'Statement 2', 'Statement 3'];
    updates.columns =
      (src.columns as string[]) ??
      (targetType === 'matrix_multi'
        ? ['Option A', 'Option B', 'Option C']
        : ['Poor', 'Fair', 'Good', 'Excellent']);
    updates.options = undefined;
  } else if (targetType === 'likert') {
    const src = source as unknown as Record<string, unknown>;
    const srcOptions = extractStringOptions(src.options);
    updates.rows =
      (src.rows as string[]) ??
      (src.items as string[]) ??
      srcOptions ??
      ['Statement 1', 'Statement 2', 'Statement 3'];
    updates.scale = (src.scale as 3 | 5 | 7) ?? 5;
    updates.options = undefined;
    updates.columns = undefined;
  } else if (targetType === 'ranking') {
    const src = source as unknown as Record<string, unknown>;
    updates.items =
      (src.items as string[]) ??
      (src.rows as string[]) ??
      extractStringOptions(src.options) ??
      ['Option A', 'Option B', 'Option C'];
    updates.options = undefined;
    updates.columns = undefined;
    updates.rows = undefined;
  } else if (targetType === 'image_choice') {
    const src = source as unknown as Record<string, unknown>;
    const existingOpts = src.options as Array<string | { label: string; imageDataUrl?: string }> | undefined;
    const fromItems = Array.isArray(src.items)
      ? (src.items as string[]).map((s) => ({ label: s }))
      : undefined;
    const fromRows = Array.isArray(src.rows)
      ? (src.rows as string[]).map((s) => ({ label: s }))
      : undefined;
    const fromOpts = existingOpts
      ? existingOpts.map((o) => (typeof o === 'string' ? { label: o } : o))
      : undefined;
    updates.options =
      fromOpts ?? fromItems ?? fromRows ?? [{ label: 'Option 1' }, { label: 'Option 2' }];
    updates.multiSelect = src.multiSelect ?? false;
    updates.rows = undefined;
    updates.columns = undefined;
    updates.items = undefined;
  } else {
    updates.min = undefined;
    updates.max = undefined;
    updates.minLabel = undefined;
    updates.maxLabel = undefined;
  }

  if (
    targetType !== 'matrix_single' &&
    targetType !== 'matrix_multi' &&
    targetType !== 'likert'
  ) {
    updates.rows = undefined;
  }
  if (targetType !== 'matrix_single' && targetType !== 'matrix_multi') {
    updates.columns = undefined;
  }
  if (targetType !== 'likert') {
    updates.scale = undefined;
  }

  if (targetType !== 'ranking') {
    updates.items = undefined;
  }

  if (targetType !== 'image_choice') {
    updates.multiSelect = undefined;
  }

  if (targetType !== 'short_text' && targetType !== 'long_text') {
    updates.placeholder = undefined;
    updates.validation = undefined;
  }

  return updates as Partial<SurveyElement>;
}
