import { nanoid } from 'nanoid';
import type { SurveyElement, SurveySettings, ElementType } from '@/types/survey';
import { DEFAULT_SETTINGS } from '@/types/survey';
import type { BlockDefaults, TemplateBlock } from './types';
import { getBlockTemplate } from './blocks';

// ---------------------------------------------------------------------------
// Blueprint type — what the AI agent returns
// ---------------------------------------------------------------------------

export interface BlueprintBlock {
  blockId: string;
  overrides?: Partial<BlockDefaults>;
}

export interface SurveyBlueprint {
  title: string;
  description: string;
  blocks: BlueprintBlock[];
  settings?: Partial<SurveySettings>;
}

// ---------------------------------------------------------------------------
// Hydration result
// ---------------------------------------------------------------------------

export interface HydrationResult {
  title: string;
  description: string;
  elements: SurveyElement[];
  settings: SurveySettings;
  /** Maps each generated element ID to its source blockId. */
  blockMap: Record<string, string>;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Hydrate a blueprint (from AI) into real SurveyElements
// ---------------------------------------------------------------------------

export function hydrateBlueprint(blueprint: SurveyBlueprint): HydrationResult {
  const elements: SurveyElement[] = [];
  const blockMap: Record<string, string> = {};
  const errors: string[] = [];

  for (const block of blueprint.blocks) {
    const template = getBlockTemplate(block.blockId);
    if (!template) {
      errors.push(`Unknown block "${block.blockId}" — skipped`);
      continue;
    }

    const merged: BlockDefaults = { ...template.defaults, ...(block.overrides || {}) };
    const id = `el_${nanoid(8)}`;
    const element = buildElement(template.elementType, id, merged);

    elements.push(element);
    blockMap[id] = block.blockId;
  }

  return {
    title: blueprint.title,
    description: blueprint.description,
    elements,
    settings: { ...DEFAULT_SETTINGS, ...(blueprint.settings || {}) },
    blockMap,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Hydrate a survey template (from gallery click) into real SurveyElements
// ---------------------------------------------------------------------------

export function hydrateSurveyTemplate(
  templateBlocks: TemplateBlock[],
  title: string,
  description: string
): HydrationResult {
  const blueprint: SurveyBlueprint = {
    title,
    description,
    blocks: templateBlocks.map((tb) => ({
      blockId: tb.blockId,
      overrides: tb.overrides,
    })),
  };
  return hydrateBlueprint(blueprint);
}

// ---------------------------------------------------------------------------
// Build a SurveyElement from merged defaults
// ---------------------------------------------------------------------------

function buildElement(
  type: ElementType,
  id: string,
  d: BlockDefaults
): SurveyElement {
  const base = {
    id,
    type,
    title: d.title,
    description: d.description,
    required: d.required,
    ...(d.accentColor && { accentColor: d.accentColor }),
    ...(d.backgroundColor && { backgroundColor: d.backgroundColor }),
  };

  switch (type) {
    case 'short_text':
      return { ...base, type: 'short_text', placeholder: d.placeholder };
    case 'long_text':
      return { ...base, type: 'long_text', placeholder: d.placeholder };
    case 'multiple_choice':
      return {
        ...base,
        type: 'multiple_choice',
        options: d.options ?? ['Option 1', 'Option 2'],
        allowOther: d.allowOther,
      };
    case 'checkboxes':
      return {
        ...base,
        type: 'checkboxes',
        options: d.options ?? ['Option 1', 'Option 2'],
        allowOther: d.allowOther,
      };
    case 'dropdown':
      return {
        ...base,
        type: 'dropdown',
        options: d.options ?? ['Option 1', 'Option 2'],
      };
    case 'linear_scale':
      return {
        ...base,
        type: 'linear_scale',
        min: d.min ?? 1,
        max: d.max ?? 5,
        minLabel: d.minLabel,
        maxLabel: d.maxLabel,
      };
    case 'nps':
      return {
        ...base,
        type: 'nps',
        minLabel: d.minLabel ?? 'Not likely',
        maxLabel: d.maxLabel ?? 'Very likely',
      };
    case 'slider':
      return {
        ...base,
        type: 'slider',
        min: d.min ?? 0,
        max: d.max ?? 100,
        step: d.step ?? 1,
        unit: d.unit,
        minLabel: d.minLabel,
        maxLabel: d.maxLabel,
      };
    case 'matrix_single':
      return {
        ...base,
        type: 'matrix_single',
        rows: d.rows ?? ['Statement 1', 'Statement 2', 'Statement 3'],
        columns: d.columns ?? ['Poor', 'Fair', 'Good', 'Excellent'],
      };
    case 'likert':
      return {
        ...base,
        type: 'likert',
        rows: d.rows ?? ['Statement 1', 'Statement 2', 'Statement 3'],
        scale: d.scale ?? 5,
      };
    case 'ranking':
      return {
        ...base,
        type: 'ranking',
        items: d.items ?? ['Option A', 'Option B', 'Option C'],
      };
    case 'image_choice':
      return {
        ...base,
        type: 'image_choice',
        options: d.imageOptions ?? [{ label: 'Option 1' }, { label: 'Option 2' }],
        multiSelect: d.multiSelect,
      };
    case 'date':
      return { ...base, type: 'date' };
    case 'file_upload':
      return { ...base, type: 'file_upload' };
    case 'section_header':
      return { ...base, type: 'section_header' };
    case 'page_break':
      return { ...base, type: 'page_break' };
    default:
      return base as SurveyElement;
  }
}
