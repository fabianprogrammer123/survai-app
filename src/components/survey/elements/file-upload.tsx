import { FileUploadElement } from '@/types/survey';
import { Label } from '@/components/ui/label';
import { Upload } from 'lucide-react';
import { ElementMode } from './element-renderer';

interface Props {
  element: FileUploadElement;
  mode: ElementMode;
  value?: File[];
  onChange?: (value: File[]) => void;
}

export function FileUploadRenderer({ element, mode }: Props) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {element.title}
        {element.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {element.description && (
        <p className="text-sm text-muted-foreground">{element.description}</p>
      )}
      <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-6 text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-8 w-8" />
          <p className="text-sm">
            {mode === 'editor' ? 'File upload area' : 'Click or drag to upload'}
          </p>
          {element.maxFiles && (
            <p className="text-xs">Max {element.maxFiles} file(s)</p>
          )}
        </div>
      </div>
    </div>
  );
}
