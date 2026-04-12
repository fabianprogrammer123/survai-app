import { SectionHeaderElement, SurveyElement } from '@/types/survey';
import { ElementMode } from './element-renderer';
import { InlineEditable } from './inline-editable';

interface Props {
  element: SectionHeaderElement;
  mode: ElementMode;
  onUpdate?: (updates: Partial<SurveyElement>) => void;
}

export function SectionHeaderRenderer({ element, mode, onUpdate }: Props) {
  if (mode === 'editor' && onUpdate) {
    return (
      <div className="space-y-1 group">
        <InlineEditable
          value={element.title}
          onChange={(v) => onUpdate({ title: v })}
          as="heading"
          placeholder="Section title"
        />
        <InlineEditable
          value={element.description || ''}
          onChange={(v) => onUpdate({ description: v })}
          as="description"
          placeholder="Add a description..."
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="text-lg font-semibold">{element.title}</h3>
      {element.description && (
        <p className="text-sm text-muted-foreground">{element.description}</p>
      )}
    </div>
  );
}
