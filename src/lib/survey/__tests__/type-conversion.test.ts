import { describe, it, expect } from 'vitest';
import { buildTypeConversion } from '../type-conversion';
import type { SurveyElement } from '@/types/survey';

/**
 * The core user complaint behind these tests: switching a question's type
 * used to wipe options with generic placeholders like "Option A". Now we
 * carry concrete source values forward — options become rows/items/columns
 * as appropriate — so type changes feel like refinements, not resets.
 */

function dropdown(opts: string[]): SurveyElement {
  return {
    id: 'el1',
    type: 'dropdown',
    title: 'Which browser do you use?',
    description: '',
    required: false,
    options: opts,
  } as SurveyElement;
}

function ranking(items: string[]): SurveyElement {
  return {
    id: 'el1',
    type: 'ranking',
    title: 'Rank these features',
    description: '',
    required: false,
    items,
  } as SurveyElement;
}

describe('buildTypeConversion — carries concrete values across type switches', () => {
  it('dropdown → ranking: options become items', () => {
    const updates = buildTypeConversion(dropdown(['Chrome', 'Firefox', 'Safari']), 'ranking');
    expect(updates.type).toBe('ranking');
    expect((updates as { items: string[] }).items).toEqual(['Chrome', 'Firefox', 'Safari']);
  });

  it('dropdown → matrix_single: options become rows (statements to rate)', () => {
    const updates = buildTypeConversion(
      dropdown(['Price', 'Reliability', 'Speed']),
      'matrix_single'
    );
    expect(updates.type).toBe('matrix_single');
    expect((updates as { rows: string[] }).rows).toEqual(['Price', 'Reliability', 'Speed']);
    // Columns get a sensible default scale when the source had no columns.
    expect((updates as { columns: string[] }).columns).toEqual(['Poor', 'Fair', 'Good', 'Excellent']);
  });

  it('ranking → multiple_choice: items become options (no generic placeholder)', () => {
    const updates = buildTypeConversion(ranking(['Speed', 'Price', 'Quality']), 'multiple_choice');
    expect(updates.type).toBe('multiple_choice');
    expect((updates as { options: string[] }).options).toEqual(['Speed', 'Price', 'Quality']);
    // Sanity: we didn't slip a placeholder in instead.
    expect((updates as { options: string[] }).options).not.toContain('Option 1');
  });

  it('short_text → dropdown with no source options falls back to a clearly-labelled default', () => {
    const source = {
      id: 'el1',
      type: 'short_text',
      title: 'Your answer',
      description: '',
      required: false,
    } as SurveyElement;
    const updates = buildTypeConversion(source, 'dropdown');
    expect(updates.type).toBe('dropdown');
    expect((updates as { options: string[] }).options).toEqual([
      'Option 1',
      'Option 2',
      'Option 3',
    ]);
  });
});
