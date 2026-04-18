import { LinearScaleElement, SurveyElement } from '@/types/survey';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ElementMode } from './element-renderer';
import { InlineEditable } from './inline-editable';

interface Props {
  element: LinearScaleElement;
  mode: ElementMode;
  value?: number;
  onChange?: (value: number) => void;
  onUpdate?: (updates: Partial<SurveyElement>) => void;
}

export function LinearScaleRenderer({ element, mode, value, onChange, onUpdate }: Props) {
  const points = Array.from(
    { length: element.max - element.min + 1 },
    (_, i) => element.min + i
  );
  const displayMode = element.mode ?? 'discrete';
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
      <div
        className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
        data-linear-scale-row="true"
        data-linear-scale-mode={displayMode}
      >
        {element.minLabel && (
          <span className="text-xs sm:text-sm text-muted-foreground shrink-0 sm:whitespace-nowrap">
            {element.minLabel}
          </span>
        )}
        {displayMode === 'continuous' ? (
          <div className="flex-1 w-full relative pt-6">
            <div
              className="absolute -top-0 left-0 right-0 flex justify-center pointer-events-none"
              aria-hidden
            >
              <span className="text-xs font-medium text-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                {value ?? element.min}
              </span>
            </div>
            <input
              type="range"
              min={element.min}
              max={element.max}
              value={value ?? element.min}
              disabled={disabled}
              onChange={(e) => onChange?.(parseInt(e.target.value))}
              className="w-full accent-primary cursor-pointer disabled:cursor-default"
              aria-label={element.title}
            />
          </div>
        ) : (
          <RadioGroup
            value={value?.toString() || ''}
            onValueChange={(v) => onChange?.(parseInt(v))}
            disabled={disabled}
            className="flex-1 flex justify-between gap-1 sm:gap-2 w-full"
          >
            {points.map((point) => (
              <div key={point} className="flex flex-col items-center gap-1">
                <RadioGroupItem value={point.toString()} id={`${element.id}-${point}`} />
                <Label htmlFor={`${element.id}-${point}`} className="text-xs font-normal">
                  {point}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}
        {element.maxLabel && (
          <span className="text-xs sm:text-sm text-muted-foreground shrink-0 sm:whitespace-nowrap sm:text-right">
            {element.maxLabel}
          </span>
        )}
      </div>
    </div>
  );
}
