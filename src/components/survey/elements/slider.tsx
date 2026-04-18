'use client';

import { useState } from 'react';
import { SliderElement, SurveyElement } from '@/types/survey';
import { Label } from '@/components/ui/label';
import { ElementMode } from './element-renderer';
import { InlineEditable } from './inline-editable';

interface Props {
  element: SliderElement;
  mode: ElementMode;
  value?: number;
  onChange?: (value: number) => void;
  onUpdate?: (updates: Partial<SurveyElement>) => void;
}

export function SliderRenderer({ element, mode, value, onChange, onUpdate }: Props) {
  // Editor-mode preview value — lets the user drag the thumb to verify
  // the visual while building the form. NOT persisted on the element.
  // Respondent modes ('view' / embed) use the controlled `value` prop.
  const [previewValue, setPreviewValue] = useState<number>(
    value ?? element.min
  );
  const isEditor = mode === 'editor';
  const step = element.step ?? 1;
  const current = isEditor ? previewValue : value ?? element.min;

  return (
    <div className="space-y-2 group">
      {mode === 'editor' && onUpdate ? (
        <>
          <div className="flex items-center gap-1">
            {element.required && <span className="text-destructive mr-1 shrink-0">*</span>}
            <InlineEditable
              value={element.title}
              onChange={(v) => onUpdate({ title: v })}
              as="title"
              placeholder="Question title"
            />
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

      <div className="flex flex-col gap-1" data-slider-row="true">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          {element.minLabel && (
            <span className="text-xs sm:text-sm text-muted-foreground shrink-0 sm:whitespace-nowrap">
              {element.minLabel}
            </span>
          )}
          <div className="flex-1 w-full relative pt-6">
            <div
              className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none"
              aria-hidden
            >
              <span
                className="text-xs font-medium text-foreground bg-muted/70 px-2 py-0.5 rounded"
                data-slider-readout="true"
              >
                {current}
                {element.unit ? element.unit : ''}
              </span>
            </div>
            <input
              type="range"
              min={element.min}
              max={element.max}
              step={step}
              value={current}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                if (isEditor) {
                  setPreviewValue(next);
                } else {
                  onChange?.(next);
                }
              }}
              className="w-full accent-primary cursor-pointer"
              aria-label={element.title}
              data-slider-input="true"
            />
          </div>
          {element.maxLabel && (
            <span className="text-xs sm:text-sm text-muted-foreground shrink-0 sm:whitespace-nowrap sm:text-right">
              {element.maxLabel}
            </span>
          )}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground/70 px-1">
          <span>
            {element.min}
            {element.unit || ''}
          </span>
          <span>
            {element.max}
            {element.unit || ''}
          </span>
        </div>
      </div>
    </div>
  );
}
