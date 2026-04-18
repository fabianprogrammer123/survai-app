'use client';

import { useRef } from 'react';
import { ImageChoiceElement, SurveyElement } from '@/types/survey';
import { Label } from '@/components/ui/label';
import { Upload, Check } from 'lucide-react';
import { ElementMode } from './element-renderer';
import { InlineEditable } from './inline-editable';
import { cn } from '@/lib/utils';

/** 2 MB per image keeps the survey JSON portable enough for data-URI storage. */
const MAX_SIZE = 2 * 1024 * 1024;

interface Props {
  element: ImageChoiceElement;
  mode: ElementMode;
  /** String label (single-select) or array of labels (multi-select). */
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  onUpdate?: (updates: Partial<SurveyElement>) => void;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ImageChoiceRenderer({ element, mode, value, onChange, onUpdate }: Props) {
  const multiSelect = !!element.multiSelect;
  const selectedArr: string[] = multiSelect
    ? Array.isArray(value)
      ? value
      : []
    : [];
  const selectedSingle: string = !multiSelect && typeof value === 'string' ? value : '';

  function toggle(label: string) {
    if (!onChange) return;
    if (multiSelect) {
      onChange(
        selectedArr.includes(label)
          ? selectedArr.filter((x) => x !== label)
          : [...selectedArr, label],
      );
    } else {
      onChange(label);
    }
  }

  async function attachImage(optionIndex: number, file: File) {
    if (!onUpdate) return;
    if (file.size > MAX_SIZE) {
      // Silently skip oversize uploads for MVP; a proper UX would show an error toast.
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    const options = [...element.options];
    options[optionIndex] = { ...options[optionIndex], imageDataUrl: dataUrl };
    onUpdate({ options } as Partial<SurveyElement>);
  }

  return (
    <div className="space-y-2 group" data-image-choice="true">
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {element.options.map((opt, i) => {
          const isSelected = multiSelect
            ? selectedArr.includes(opt.label)
            : selectedSingle === opt.label;
          return (
            <ImageChoiceCell
              key={i}
              option={opt}
              index={i}
              isSelected={isSelected}
              editor={mode === 'editor'}
              onToggle={() => toggle(opt.label)}
              onImageAttach={onUpdate ? (file) => attachImage(i, file) : undefined}
              onLabelChange={
                onUpdate
                  ? (label) => {
                      const options = [...element.options];
                      options[i] = { ...options[i], label };
                      onUpdate({ options } as Partial<SurveyElement>);
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}

interface CellProps {
  option: { label: string; imageDataUrl?: string };
  index: number;
  isSelected: boolean;
  editor: boolean;
  onToggle: () => void;
  onImageAttach?: (file: File) => void;
  onLabelChange?: (label: string) => void;
}

function ImageChoiceCell({
  option,
  index,
  isSelected,
  editor,
  onToggle,
  onImageAttach,
  onLabelChange,
}: CellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className={cn(
        'relative rounded-lg border overflow-hidden cursor-pointer transition-all',
        isSelected
          ? 'border-primary ring-2 ring-primary/20'
          : 'border-border/50 hover:border-border',
      )}
      onClick={editor ? undefined : onToggle}
      data-image-choice-cell="true"
    >
      <div className="aspect-square bg-muted/30 flex items-center justify-center relative">
        {option.imageDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={option.imageDataUrl}
            alt={option.label}
            className="w-full h-full object-cover"
          />
        ) : editor ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && onImageAttach) onImageAttach(f);
              }}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              className="flex flex-col items-center gap-1 text-xs text-muted-foreground"
            >
              <Upload className="h-5 w-5" />
              Add image
            </button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">No image</span>
        )}
        {isSelected && (
          <div className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <Check className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
      {editor && onLabelChange ? (
        <input
          className="w-full px-2 py-1.5 text-xs bg-transparent outline-none border-t border-border/40"
          value={option.label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder={`Option ${index + 1}`}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="px-2 py-1.5 text-xs border-t border-border/40">{option.label}</div>
      )}
    </div>
  );
}
