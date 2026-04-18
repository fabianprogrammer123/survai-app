'use client';

import { LikertElement, MatrixSingleElement, SurveyElement } from '@/types/survey';
import { MatrixSingleRenderer } from './matrix-single';
import { ElementMode } from './element-renderer';

const LIKERT_SCALES: Record<3 | 5 | 7, readonly string[]> = {
  3: ['Disagree', 'Neutral', 'Agree'],
  5: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
  7: [
    'Strongly Disagree',
    'Disagree',
    'Somewhat Disagree',
    'Neutral',
    'Somewhat Agree',
    'Agree',
    'Strongly Agree',
  ],
} as const;

interface Props {
  element: LikertElement;
  mode: ElementMode;
  value?: Record<string, string>;
  onChange?: (value: Record<string, string>) => void;
  onUpdate?: (updates: Partial<SurveyElement>) => void;
}

export function LikertRenderer({ element, mode, value, onChange, onUpdate }: Props) {
  const scale: 3 | 5 | 7 = element.scale ?? 5;
  const synthetic: MatrixSingleElement = {
    id: element.id,
    type: 'matrix_single',
    title: element.title,
    description: element.description,
    required: element.required,
    accentColor: element.accentColor,
    backgroundColor: element.backgroundColor,
    rows: element.rows,
    columns: [...LIKERT_SCALES[scale]],
  };
  return (
    <MatrixSingleRenderer
      element={synthetic}
      mode={mode}
      value={value}
      onChange={onChange}
      onUpdate={onUpdate}
    />
  );
}
