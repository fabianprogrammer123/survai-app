'use client';

import { NpsElement, SurveyElement } from '@/types/survey';
import { Label } from '@/components/ui/label';
import { ElementMode } from './element-renderer';
import { InlineEditable } from './inline-editable';
import { cn } from '@/lib/utils';

interface Props {
  element: NpsElement;
  mode: ElementMode;
  value?: number;
  onChange?: (value: number) => void;
  onUpdate?: (updates: Partial<SurveyElement>) => void;
}

function zoneFor(n: number): 'detractor' | 'passive' | 'promoter' {
  if (n <= 6) return 'detractor';
  if (n <= 8) return 'passive';
  return 'promoter';
}

const ZONE_COLORS = {
  detractor: {
    base: 'bg-red-100 hover:bg-red-200 text-red-900 border-red-200 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-200 dark:border-red-900/60',
    selected: 'bg-red-500 text-white border-red-500',
  },
  passive: {
    base: 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 dark:text-amber-200 dark:border-amber-900/60',
    selected: 'bg-amber-500 text-white border-amber-500',
  },
  promoter: {
    base: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-200 dark:border-emerald-900/60',
    selected: 'bg-emerald-500 text-white border-emerald-500',
  },
};

export function NpsRenderer({ element, mode, value, onChange, onUpdate }: Props) {
  const disabled = mode === 'editor';
  return (
    <div className="space-y-2 group">
      {mode === 'editor' && onUpdate ? (
        <>
          <div className="flex items-center gap-1">
            <InlineEditable
              value={element.title}
              onChange={(v) => onUpdate({ title: v })}
              as="title"
              placeholder="Question title"
            />
            {element.required && <span className="text-destructive ml-1">*</span>}
          </div>
          <InlineEditable
            value={element.description || ''}
            onChange={(v) => onUpdate({ description: v })}
            as="description"
            placeholder="Add a description..."
          />
        </>
      ) : (
        <>
          <Label className="text-sm font-medium">
            {element.title}
            {element.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {element.description && (
            <p className="text-sm text-muted-foreground">{element.description}</p>
          )}
        </>
      )}

      <div className="flex gap-1 flex-wrap" data-nps-row>
        {Array.from({ length: 11 }, (_, n) => {
          const zone = zoneFor(n);
          const sel = value === n;
          const colors = ZONE_COLORS[zone];
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(n)}
              className={cn(
                'min-w-[36px] h-10 flex-1 rounded-md border text-sm font-medium transition-all',
                sel ? colors.selected : colors.base,
                disabled && 'cursor-default'
              )}
              aria-label={`Score ${n}`}
              data-nps-value={n}
              data-nps-zone={zone}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{element.minLabel ?? 'Not likely'}</span>
        <span>{element.maxLabel ?? 'Very likely'}</span>
      </div>
    </div>
  );
}
