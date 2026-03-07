import { LongTextElement } from '@/types/survey';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ElementMode } from './element-renderer';

interface Props {
  element: LongTextElement;
  mode: ElementMode;
  value?: string;
  onChange?: (value: string) => void;
}

export function LongTextRenderer({ element, mode, value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {element.title}
        {element.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {element.description && (
        <p className="text-sm text-muted-foreground">{element.description}</p>
      )}
      <Textarea
        placeholder={element.placeholder || 'Your answer'}
        disabled={mode === 'editor'}
        readOnly={mode === 'preview'}
        value={mode === 'response' ? (value || '') : ''}
        onChange={(e) => onChange?.(e.target.value)}
        rows={4}
      />
    </div>
  );
}
