import { CheckboxesElement, SurveyElement } from '@/types/survey';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ElementMode } from './element-renderer';
import { InlineEditable } from './inline-editable';

interface Props {
  element: CheckboxesElement;
  mode: ElementMode;
  value?: string[];
  onChange?: (value: string[]) => void;
  onUpdate?: (updates: Partial<SurveyElement>) => void;
}

export function CheckboxesRenderer({ element, mode, value = [], onChange, onUpdate }: Props) {
  const handleToggle = (option: string, checked: boolean) => {
    if (!onChange) return;
    if (checked) {
      onChange([...value, option]);
    } else {
      onChange(value.filter((v) => v !== option));
    }
  };

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
      <div className="space-y-2">
        {element.options.map((option, i) => (
          <div key={i} className="flex items-center space-x-2">
            <Checkbox
              id={`${element.id}-${i}`}
              checked={value.includes(option)}
              onCheckedChange={(checked) => handleToggle(option, !!checked)}
              disabled={mode === 'editor'}
            />
            {mode === 'editor' && onUpdate ? (
              <input
                type="text"
                value={option}
                onChange={(e) => {
                  const newOptions = [...element.options];
                  newOptions[i] = e.target.value;
                  onUpdate({ options: newOptions });
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="bg-transparent border-none outline-none text-sm font-normal w-full rounded px-1 -mx-1 transition-colors focus:bg-muted/30 focus:ring-1 focus:ring-primary/20"
                placeholder={`Option ${i + 1}`}
              />
            ) : (
              <Label htmlFor={`${element.id}-${i}`} className="font-normal">
                {option}
              </Label>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
