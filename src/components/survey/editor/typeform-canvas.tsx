'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SurveyElement } from '@/types/survey';
import { ElementRenderer } from '@/components/survey/elements/element-renderer';
import { useSurveyStore } from '@/lib/survey/store';
import { AddElementButton } from './add-element-button';

interface Props {
  elements: SurveyElement[];
}

/**
 * Typeform-style one-question-at-a-time canvas. Fades between
 * questions with Framer Motion. Arrow keys + click buttons navigate.
 */
export function TypeformCanvas({ elements }: Props) {
  const [index, setIndex] = useState(0);
  const updateElement = useSurveyStore((s) => s.updateElement);

  // Note: a clamping effect here would trip react-hooks/set-state-in-effect.
  // We clamp at read time (`current` below) and in goPrev/goNext, so stale
  // index values are harmless even after deletions.

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(elements.length - 1, i + 1));
  }, [elements.length]);

  // Keyboard navigation — ignore while user is typing in a field
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext]);

  if (elements.length === 0) {
    return (
      <div className="py-8" data-typeform-canvas="true">
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Add a question to begin
        </div>
        <div className="mt-6">
          <AddElementButton />
        </div>
      </div>
    );
  }

  const current = elements[Math.min(index, elements.length - 1)];
  const progress = elements.length > 0 ? ((index + 1) / elements.length) * 100 : 0;

  return (
    <div className="py-8" data-typeform-canvas="true">
      {/* Progress bar */}
      <div className="mb-6 h-1 w-full rounded-full bg-muted/40 overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question slide */}
      <div className="relative min-h-[280px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="survey-card rounded-2xl border border-border/30 bg-card p-8 shadow-md"
          >
            <ElementRenderer
              element={current}
              mode="editor"
              onUpdate={(updates) => updateElement(current.id, updates)}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav controls */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={goPrev}
          disabled={index === 0}
          data-typeform-prev="true"
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          {index + 1} / {elements.length}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={goNext}
          disabled={index >= elements.length - 1}
          data-typeform-next="true"
        >
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Add question (mirrors Google Forms canvas path) */}
      <div className="mt-6">
        <AddElementButton />
      </div>
    </div>
  );
}
