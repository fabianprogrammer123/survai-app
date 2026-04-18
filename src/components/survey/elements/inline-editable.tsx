'use client';

import { cn } from '@/lib/utils';
import type { SurveyElement } from '@/types/survey';

interface InlineEditableProps {
  value: string;
  onChange: (value: string) => void;
  as?: 'title' | 'description' | 'heading';
  placeholder?: string;
  className?: string;
}

/**
 * Shared inline-editable text component for survey element titles and descriptions.
 * Renders a transparent input that looks like static text but is editable on click.
 */
export function InlineEditable({
  value,
  onChange,
  as = 'title',
  placeholder,
  className,
}: InlineEditableProps) {
  // No background, no ring, no outline — editable text reads as plain text
  // at rest and shows only the text caret when focused. The `appearance-none`
  // + `!bg-transparent` defeat Chromium's dark-mode user-agent stylesheet
  // which would otherwise apply a subtle background fill that creates a
  // shaded rectangle visually clashing with the element-type badge.
  const baseClasses =
    'appearance-none !bg-transparent border-none outline-none focus:outline-none w-full px-1 -mx-1 transition-colors';

  if (as === 'heading') {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        placeholder={placeholder || 'Section title'}
        className={cn(baseClasses, 'text-lg font-semibold', className)}
      />
    );
  }

  if (as === 'description') {
    return (
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        placeholder={placeholder || 'Add a description...'}
        className={cn(
          baseClasses,
          'text-sm text-muted-foreground',
          !value && 'opacity-0 group-hover:opacity-50 focus:opacity-100',
          className
        )}
      />
    );
  }

  // title (default)
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      placeholder={placeholder || 'Question title'}
      className={cn(baseClasses, 'text-sm font-medium', className)}
    />
  );
}
