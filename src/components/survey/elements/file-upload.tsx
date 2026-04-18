'use client';

import { useRef, useState } from 'react';
import { FileUploadElement, SurveyElement } from '@/types/survey';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, X, File as FileIcon } from 'lucide-react';
import { ElementMode } from './element-renderer';
import { InlineEditable } from './inline-editable';
import { cn } from '@/lib/utils';

interface StoredFile {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

interface Props {
  element: FileUploadElement;
  mode: ElementMode;
  value?: StoredFile[];
  onChange?: (value: StoredFile[]) => void;
  onUpdate?: (updates: Partial<SurveyElement>) => void;
}

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

function fileToStored(file: File): Promise<StoredFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: reader.result as string,
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function FileUploadRenderer({ element, mode, value = [], onChange, onUpdate }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const maxFiles = element.maxFiles ?? 3;

  async function handleFiles(files: FileList | null) {
    if (!files || !onChange) return;
    setError(null);
    const existing = value.length;
    const available = Math.max(0, maxFiles - existing);
    const toProcess = Array.from(files).slice(0, available);

    const next: StoredFile[] = [...value];
    for (const f of toProcess) {
      if (f.size > MAX_SIZE_BYTES) {
        setError(`${f.name} exceeds the 2 MB limit`);
        continue;
      }
      try {
        const stored = await fileToStored(f);
        next.push(stored);
      } catch {
        setError(`Failed to read ${f.name}`);
      }
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeAt(i: number) {
    if (!onChange) return;
    onChange(value.filter((_, idx) => idx !== i));
  }

  const isResponse = mode === 'response' || (!onUpdate && !!onChange);

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

      {isResponse ? (
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={element.acceptedTypes?.join(',')}
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            data-file-upload-input
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={value.length >= maxFiles}
            className="w-full sm:w-auto"
          >
            <Upload className="h-4 w-4 mr-2" /> Choose files
          </Button>
          {value.length > 0 && (
            <ul className="space-y-1" data-file-list>
              {value.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-sm bg-muted/30 rounded-md px-2 py-1.5"
                >
                  <FileIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {(f.size / 1024).toFixed(1)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            Max {maxFiles} file(s), up to 2 MB each.
          </p>
        </div>
      ) : (
        <div
          className={cn(
            'flex items-center justify-center rounded-lg border-2 border-dashed p-6 text-muted-foreground'
          )}
        >
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8" />
            <p className="text-sm">File upload</p>
            {element.maxFiles && (
              <p className="text-xs">Max {element.maxFiles} file(s), 2 MB each</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
