import { ShortTextElement, SurveyElement } from '@/types/survey';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ElementMode } from './element-renderer';
import { InlineEditable } from './inline-editable';

interface Props {
  element: ShortTextElement;
  mode: ElementMode;
  value?: string;
  onChange?: (value: string) => void;
  onUpdate?: (updates: Partial<SurveyElement>) => void;
}

export function ShortTextRenderer({ element, mode, value, onChange, onUpdate }: Props) {
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
      <Input
        placeholder={element.placeholder || 'Your answer'}
        disabled={mode === 'editor'}
        readOnly={mode === 'preview'}
        value={mode === 'response' ? (value || '') : ''}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  );
}
