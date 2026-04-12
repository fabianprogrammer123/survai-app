'use client';

import { useEffect } from 'react';
import { useSurveyStore } from '@/lib/survey/store';

/**
 * Syncs the survey's colorMode setting with the `dark` class on <html>.
 * When colorMode is 'light', removes the `dark` class → activates :root (light) CSS vars.
 * When colorMode is 'dark', adds the `dark` class → activates .dark CSS vars.
 *
 * Call this hook once in the editor layout.
 */
export function useColorMode() {
  const colorMode = useSurveyStore((s) => s.survey.settings.colorMode) || 'dark';

  useEffect(() => {
    const html = document.documentElement;
    if (colorMode === 'light') {
      html.classList.remove('dark');
    } else {
      html.classList.add('dark');
    }

    // Restore dark mode on unmount (when leaving the editor)
    return () => {
      html.classList.add('dark');
    };
  }, [colorMode]);
}
