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
      >
        {element.minLabel && (
          <span className="text-xs sm:text-sm text-muted-foreground shrink-0 sm:whitespace-nowrap">
            {element.minLabel}
          </span>
        )}
        <RadioGroup
          value={value?.toString() || ''}
          onValueChange={(v) => onChange?.(parseInt(v))}
          disabled={mode === 'editor'}
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
        {element.maxLabel && (
          <span className="text-xs sm:text-sm text-muted-foreground shrink-0 sm:whitespace-nowrap sm:text-right">
            {element.maxLabel}
          </span>
        )}
      </div>
    </div>
  );
}
