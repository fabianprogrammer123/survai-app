'use client';

import { useState, useEffect } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { STYLE_PRESETS, type StylePreset } from '@/lib/survey/presets';
import { cn } from '@/lib/utils';

interface ThemeProviderProps {
  children: React.ReactNode;
  className?: string;
}

export function SurveyThemeProvider({ children, className }: ThemeProviderProps) {
  const stylePreset = useSurveyStore((s) => s.survey.settings.stylePreset) || 'google-forms';
  const colorMode = useSurveyStore((s) => s.survey.settings.colorMode) || 'dark';
  const fontFamily = useSurveyStore((s) => s.survey.settings.fontFamily);

  // Prevent hydration mismatch: render with defaults on first frame,
  // then apply store values after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Resolve the preset key: combine style + color mode
  const resolvedStyle = mounted ? stylePreset : 'google-forms';
  const resolvedMode = mounted ? colorMode : 'dark';
  const presetKey = `${resolvedStyle}-${resolvedMode}` as StylePreset;
  const config = STYLE_PRESETS[presetKey] || STYLE_PRESETS['google-forms-dark'];
  const fontClass = fontFamily ? `font-survey-${fontFamily}` : `font-survey-${config.fontFamily}`;

  return (
    <div
      className={cn('survey-theme', fontClass, config.className, className)}
      style={config.cssVars as React.CSSProperties}
      suppressHydrationWarning
    >
      {children}
    </div>
  );
}
