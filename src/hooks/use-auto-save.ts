'use client';

import { useEffect, useRef } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { createClient } from '@/lib/supabase/client';

export function useAutoSave() {
  const survey = useSurveyStore((s) => s.survey);
  const isDirty = useSurveyStore((s) => s.isDirty);
  const markClean = useSurveyStore((s) => s.markClean);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isDirty || !survey.id) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from('surveys')
        .update({
          title: survey.title,
          description: survey.description,
          schema: survey.elements,
          settings: survey.settings,
        })
        .eq('id', survey.id);

      if (!error) {
        markClean();
      } else {
        console.error('Auto-save failed:', error);
      }
    }, 1500);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [survey, isDirty, markClean]);
}
