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
  const baseClasses =
    'bg-transparent border-none outline-none w-full rounded px-1 -mx-1 transition-colors focus:bg-muted/30 focus:ring-1 focus:ring-primary/20';

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
