import { MultipleChoiceElement, SurveyElement } from '@/types/survey';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ElementMode } from './element-renderer';
import { InlineEditable } from './inline-editable';

interface Props {
  element: MultipleChoiceElement;
  mode: ElementMode;
  value?: string;
  onChange?: (value: string) => void;
  onUpdate?: (updates: Partial<SurveyElement>) => void;
}

export function MultipleChoiceRenderer({ element, mode, value, onChange, onUpdate }: Props) {
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
      <RadioGroup
        value={value || ''}
        onValueChange={onChange}
        disabled={mode === 'editor'}
        className="space-y-2"
      >
        {element.options.map((option, i) => (
          <div key={i} className="flex items-center space-x-2 group/option">
            <RadioGroupItem value={option} id={`${element.id}-${i}`} disabled={mode === 'editor'} />
            {mode === 'editor' && onUpdate ? (
              <>
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
                  className="bg-transparent border-none outline-none text-sm font-normal flex-1 rounded px-1 -mx-1 transition-colors focus:bg-muted/30 focus:ring-1 focus:ring-primary/20"
                  placeholder={`Option ${i + 1}`}
                />
                {element.options.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Remove option ${i + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const newOptions = element.options.filter((_, idx) => idx !== i);
                      onUpdate({ options: newOptions });
                    }}
                    className="opacity-0 group-hover/option:opacity-100 text-muted-foreground hover:text-destructive transition-opacity text-xs px-1"
                  >
                    ✕
                  </button>
                )}
              </>
            ) : (
              <Label htmlFor={`${element.id}-${i}`} className="font-normal">
                {option}
              </Label>
            )}
          </div>
        ))}
        {mode === 'editor' && onUpdate && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUpdate({ options: [...element.options, `Option ${element.options.length + 1}`] });
            }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors ml-6 py-1"
            data-add-option="multiple-choice"
          >
            <span className="h-4 w-4 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center">+</span>
            Add option
          </button>
        )}
      </RadioGroup>
    </div>
  );
}
