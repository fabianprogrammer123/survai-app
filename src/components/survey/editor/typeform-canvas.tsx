'use client';

import type { SurveyElement } from '@/types/survey';
import { ElementRenderer } from '@/components/survey/elements/element-renderer';

interface Props {
  elements: SurveyElement[];
}

/**
 * One-question-at-a-time canvas renderer used by the Typeform preset.
 * Stub: renders only the first element. Plan B Task 8 fleshes out navigation
 * and transitions.
 */
export function TypeformCanvas({ elements }: Props) {
  const first = elements[0];
  if (!first) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Add a question to begin
      </div>
    );
  }
  return (
    <div className="py-8" data-typeform-canvas="true">
      <div className="survey-card rounded-xl border border-border/30 bg-card p-6 shadow-sm">
        <ElementRenderer element={first} mode="editor" />
      </div>
    </div>
  );
}
