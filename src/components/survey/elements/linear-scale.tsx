import { LinearScaleElement } from '@/types/survey';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ElementMode } from './element-renderer';

interface Props {
  element: LinearScaleElement;
  mode: ElementMode;
  value?: number;
  onChange?: (value: number) => void;
}

export function LinearScaleRenderer({ element, mode, value, onChange }: Props) {
  const points = Array.from(
    { length: element.max - element.min + 1 },
    (_, i) => element.min + i
  );

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {element.title}
        {element.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {element.description && (
        <p className="text-sm text-muted-foreground">{element.description}</p>
      )}
      <div className="flex items-center gap-2">
        {element.minLabel && (
          <span className="text-sm text-muted-foreground">{element.minLabel}</span>
        )}
        <RadioGroup
          value={value?.toString() || ''}
          onValueChange={(v) => onChange?.(parseInt(v))}
          disabled={mode === 'editor'}
          className="flex gap-2"
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
          <span className="text-sm text-muted-foreground">{element.maxLabel}</span>
        )}
      </div>
    </div>
  );
}
