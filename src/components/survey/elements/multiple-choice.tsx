import { MultipleChoiceElement } from '@/types/survey';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ElementMode } from './element-renderer';

interface Props {
  element: MultipleChoiceElement;
  mode: ElementMode;
  value?: string;
  onChange?: (value: string) => void;
}

export function MultipleChoiceRenderer({ element, mode, value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {element.title}
        {element.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {element.description && (
        <p className="text-sm text-muted-foreground">{element.description}</p>
      )}
      <RadioGroup
        value={value || ''}
        onValueChange={onChange}
        disabled={mode === 'editor'}
        className="space-y-2"
      >
        {element.options.map((option, i) => (
          <div key={i} className="flex items-center space-x-2">
            <RadioGroupItem value={option} id={`${element.id}-${i}`} />
            <Label htmlFor={`${element.id}-${i}`} className="font-normal">
              {option}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
