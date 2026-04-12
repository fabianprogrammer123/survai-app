import type { BlockTemplate, SurveyTemplate } from './types';
import { BLOCK_TEMPLATES } from './blocks';
import { SURVEY_TEMPLATES } from './surveys';

/**
 * Compact block catalog string for the AI system prompt.
 * Groups blocks by category; each line shows blockId, default title, and element type.
 */
export function blocksToPromptString(blocks: BlockTemplate[] = BLOCK_TEMPLATES): string {
  const groups: Record<string, BlockTemplate[]> = {};
  for (const b of blocks) {
    (groups[b.category] ??= []).push(b);
  }

  return Object.entries(groups)
    .map(([category, items]) => {
      const header = category.toUpperCase();
      const lines = items.map((b) => {
        const extras: string[] = [`${b.elementType}`];
        if (b.defaults.options) extras.push(`options: ${b.defaults.options.length}`);
        if (b.defaults.min !== undefined) extras.push(`${b.defaults.min}–${b.defaults.max}`);
        return `  - ${b.blockId}: "${b.defaults.title}" (${extras.join(', ')})`;
      });
      return `${header}:\n${lines.join('\n')}`;
    })
    .join('\n\n');
}

/**
 * Compact survey template catalog for the AI system prompt.
 */
export function templatesToPromptString(templates: SurveyTemplate[] = SURVEY_TEMPLATES): string {
  return templates
    .filter((t) => t.templateId !== 'blank')
    .map(
      (t) =>
        `  - ${t.templateId}: ${t.label} — ${t.description} (${t.blocks.length} blocks)`
    )
    .join('\n');
}

/**
 * Lists all valid blockIds — used by the Zod schema description to constrain agent output.
 */
export function validBlockIds(blocks: BlockTemplate[] = BLOCK_TEMPLATES): string[] {
  return blocks.map((b) => b.blockId);
}
