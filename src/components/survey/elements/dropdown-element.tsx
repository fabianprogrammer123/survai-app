import { DropdownElement, SurveyElement } from '@/types/survey';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ElementMode } from './element-renderer';
import { InlineEditable } from './inline-editable';

interface Props {
  element: DropdownElement;
  mode: ElementMode;
  value?: string;
  onChange?: (value: string) => void;
  onUpdate?: (updates: Partial<SurveyElement>) => void;
}

export function DropdownRenderer({ element, mode, value, onChange, onUpdate }: Props) {
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
      {mode === 'editor' && onUpdate ? (
        <div className="space-y-1.5 rounded-md border p-2">
          {element.options.map((option, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}.</span>
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
                className="bg-transparent border-none outline-none text-sm w-full rounded px-1 transition-colors focus:bg-muted/30 focus:ring-1 focus:ring-primary/20"
                placeholder={`Option ${i + 1}`}
              />
            </div>
          ))}
        </div>
      ) : (
        <Select
          value={value || ''}
          onValueChange={(v) => { if (v !== null) onChange?.(v); }}
          disabled={mode === 'editor'}
        >
          <SelectTrigger className={mode === 'response' ? 'h-11 sm:h-10 text-base' : undefined}>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {element.options.map((option, i) => (
              <SelectItem key={i} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
