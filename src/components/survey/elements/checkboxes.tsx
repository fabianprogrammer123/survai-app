import { CheckboxesElement } from '@/types/survey';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ElementMode } from './element-renderer';

interface Props {
  element: CheckboxesElement;
  mode: ElementMode;
  value?: string[];
  onChange?: (value: string[]) => void;
}

export function CheckboxesRenderer({ element, mode, value = [], onChange }: Props) {
  const handleToggle = (option: string, checked: boolean) => {
    if (!onChange) return;
    if (checked) {
      onChange([...value, option]);
    } else {
      onChange(value.filter((v) => v !== option));
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {element.title}
        {element.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {element.description && (
        <p className="text-sm text-muted-foreground">{element.description}</p>
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
            <Label htmlFor={`${element.id}-${i}`} className="font-normal">
              {option}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
