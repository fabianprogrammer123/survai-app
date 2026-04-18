import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSurveyStore } from '../store';
import type { SurveyElement, Survey } from '@/types/survey';
import { DEFAULT_SETTINGS } from '@/types/survey';

function makeElement(id: string, type: SurveyElement['type'] = 'short_text'): SurveyElement {
  return {
    id,
    type,
    title: `Element ${id}`,
    description: '',
    required: false,
  } as SurveyElement;
}

const baseSurvey: Survey = {
  id: 'test-survey',
  title: 'Test',
  description: '',
  elements: [],
  settings: DEFAULT_SETTINGS,
  published: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('survey store — element sanitization', () => {
  beforeEach(() => {
    useSurveyStore.getState().setSurvey({ ...baseSurvey, elements: [] });
    // Silence the informational warnings during tests
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('addElement refuses null, undefined, or malformed entries', () => {
    const store = useSurveyStore.getState();

    // @ts-expect-error deliberately bad input
    store.addElement(undefined);
    // @ts-expect-error deliberately bad input
    store.addElement(null);
    // @ts-expect-error deliberately bad input
    store.addElement({ title: 'no id or type' });
    // @ts-expect-error deliberately bad input
    store.addElement({ id: 42, type: 'short_text' });

    expect(useSurveyStore.getState().survey.elements).toEqual([]);
  });

  it('addElement accepts a valid element and records its id', () => {
    const store = useSurveyStore.getState();
    const el = makeElement('el_abc');

    store.addElement(el);

    const state = useSurveyStore.getState();
    expect(state.survey.elements).toHaveLength(1);
    expect(state.survey.elements[0].id).toBe('el_abc');
    expect(state.selectedElementId).toBe('el_abc');
  });

  it('replaceElements drops null and malformed entries via sanitizeElements', () => {
    const store = useSurveyStore.getState();
    const valid = makeElement('el_ok');

    // Mixed array: valid, null, undefined, bad shape
    const mixed = [
      valid,
      null,
      undefined,
      { title: 'bad' },
      { id: 'el_nope', type: 123 },
    ] as unknown as SurveyElement[];

    store.replaceElements(mixed);

    const elements = useSurveyStore.getState().survey.elements;
    expect(elements).toHaveLength(1);
    expect(elements[0].id).toBe('el_ok');
    // No nullish entries slipped through — this is the core guard.
    expect(elements.every((el) => el != null && typeof el.type === 'string')).toBe(true);
  });

  it('applyGeneration sanitizes its elements before committing them', () => {
    const store = useSurveyStore.getState();
    const good = makeElement('el_good');

    store.applyGeneration({
      survey: {
        title: 'Generated',
        description: 'desc',
        // Force a dirty array to ensure the sanitizer runs.
        elements: [good, null, undefined] as unknown as SurveyElement[],
        settings: DEFAULT_SETTINGS,
      },
      blockMap: { el_good: 'open_feedback' },
    });

    const state = useSurveyStore.getState();
    expect(state.survey.elements).toHaveLength(1);
    expect(state.survey.elements[0].id).toBe('el_good');
    expect(state.survey.title).toBe('Generated');
    expect(state.elementBlockMap).toEqual({ el_good: 'open_feedback' });
  });
});
