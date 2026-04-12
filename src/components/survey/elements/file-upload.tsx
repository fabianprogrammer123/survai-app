import { FileUploadElement, SurveyElement } from '@/types/survey';
import { Label } from '@/components/ui/label';
import { Upload } from 'lucide-react';
import { ElementMode } from './element-renderer';
import { InlineEditable } from './inline-editable';

interface Props {
  element: FileUploadElement;
  mode: ElementMode;
  value?: File[];
  onChange?: (value: File[]) => void;
  onUpdate?: (updates: Partial<SurveyElement>) => void;
}

export function FileUploadRenderer({ element, mode, onUpdate }: Props) {
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
      <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-6 text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-8 w-8" />
          {mode === 'editor' ? (
            <p className="text-sm">File upload area</p>
          ) : (
            <p className="text-sm text-muted-foreground/70">File upload coming soon</p>
          )}
          {element.maxFiles && (
            <p className="text-xs">Max {element.maxFiles} file(s)</p>
          )}
        </div>
      </div>
    </div>
  );
}
