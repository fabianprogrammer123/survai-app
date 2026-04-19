import { describe, it, expect, beforeEach } from 'vitest';
import { uiCommandSchema } from '../schema';
import { executeCommands } from '../command-executor';
import { useSurveyStore } from '@/lib/survey/store';
import { DEFAULT_SETTINGS, type Survey, type SurveyElement } from '@/types/survey';

function makeElement(id: string, title: string): SurveyElement {
  return {
    id,
    type: 'short_text',
    title,
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

describe('command pipeline — schema parse → executeCommands applies the edit', () => {
  beforeEach(() => {
    useSurveyStore.getState().setSurvey({
      ...baseSurvey,
      elements: [
        makeElement('el_q1', 'Question 1'),
        makeElement('el_q2', 'Question 2'),
        makeElement('el_q3', 'Question 3 (last)'),
      ],
    });
  });

  it('end-to-end: a `type`-aliased delete_element command reaches the store and removes the element', () => {
    // Shape that used to trip zod on the authenticated route — matches
    // the payload the model emits when it guesses `type` over `action`.
    const rawFromModel = { type: 'delete_element', elementId: 'el_q3' };

    const parsed = uiCommandSchema.safeParse(rawFromModel);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    executeCommands([parsed.data]);

    const elements = useSurveyStore.getState().survey.elements;
    expect(elements).toHaveLength(2);
    expect(elements.find((el) => el.id === 'el_q3')).toBeUndefined();
    expect(elements.map((el) => el.id)).toEqual(['el_q1', 'el_q2']);
  });

  it('end-to-end: a canonical-shape move_element command also applies', () => {
    const parsed = uiCommandSchema.safeParse({
      action: 'move_element',
      elementId: 'el_q1',
      toIndex: 2,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    executeCommands([parsed.data]);

    const ids = useSurveyStore.getState().survey.elements.map((el) => el.id);
    expect(ids).toEqual(['el_q2', 'el_q3', 'el_q1']);
  });
});
