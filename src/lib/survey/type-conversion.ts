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
    const raw =
      'options' in source
        ? (source as { options: Array<string | { label: string }> }).options
        : undefined;
    const stringOpts = raw
      ? raw.map((o) => (typeof o === 'string' ? o : o.label))
      : undefined;
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
    updates.rows = (src.rows as string[]) ?? ['Statement 1', 'Statement 2', 'Statement 3'];
    updates.columns =
      (src.columns as string[]) ??
      (targetType === 'matrix_multi'
        ? ['Option A', 'Option B', 'Option C']
        : ['Poor', 'Fair', 'Good', 'Excellent']);
    updates.options = undefined;
  } else if (targetType === 'likert') {
    const src = source as unknown as Record<string, unknown>;
    updates.rows = (src.rows as string[]) ?? ['Statement 1', 'Statement 2', 'Statement 3'];
    updates.scale = (src.scale as 3 | 5 | 7) ?? 5;
    updates.options = undefined;
    updates.columns = undefined;
  } else if (targetType === 'ranking') {
    const src = source as unknown as Record<string, unknown>;
    updates.items = (src.items as string[]) ?? (src.options as string[]) ?? ['Option A', 'Option B', 'Option C'];
    updates.options = undefined;
    updates.columns = undefined;
    updates.rows = undefined;
  } else if (targetType === 'image_choice') {
    const src = source as unknown as Record<string, unknown>;
    const existingOpts = src.options as Array<string | { label: string; imageDataUrl?: string }> | undefined;
    updates.options = existingOpts
      ? existingOpts.map((o) => (typeof o === 'string' ? { label: o } : o))
      : [{ label: 'Option 1' }, { label: 'Option 2' }];
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
