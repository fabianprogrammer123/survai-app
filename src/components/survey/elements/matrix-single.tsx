'use client';

import { MatrixSingleElement, SurveyElement } from '@/types/survey';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ElementMode } from './element-renderer';
import { InlineEditable } from './inline-editable';

interface Props {
  element: MatrixSingleElement;
  mode: ElementMode;
  value?: Record<string, string>;
  onChange?: (value: Record<string, string>) => void;
  onUpdate?: (updates: Partial<SurveyElement>) => void;
}

export function MatrixSingleRenderer({ element, mode, value = {}, onChange, onUpdate }: Props) {
  function setRowValue(rowKey: string, columnValue: string) {
    if (!onChange) return;
    onChange({ ...value, [rowKey]: columnValue });
  }

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

      <div className="overflow-x-auto -mx-2 px-2" data-matrix-single>
        <table
          className="w-full text-sm border-collapse min-w-[420px]"
          style={{ tableLayout: 'fixed' }}
        >
          <colgroup>
            {/* First column (row labels) gets a fixed width; the remaining
                value columns split the rest equally so radio dots are
                evenly spaced regardless of header text length. */}
            <col style={{ width: '35%' }} />
            {element.columns.map((_, ci) => (
              <col key={ci} style={{ width: `${65 / element.columns.length}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="text-left pb-2 pr-3 font-normal text-muted-foreground"></th>
              {element.columns.map((col, ci) => (
                <th
                  key={ci}
                  className="pb-2 px-2 font-normal text-xs text-muted-foreground text-center break-words"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {element.rows.map((row, ri) => {
              const rowKey = `row-${ri}`;
              return (
                <tr key={ri} className="border-t border-border/40">
                  <td className="py-2 pr-3 text-sm">{row}</td>
                  {element.columns.map((col, ci) => (
                    <td key={ci} className="py-2 px-2 text-center">
                      <RadioGroup
                        value={value[rowKey] ?? ''}
                        onValueChange={(v) => setRowValue(rowKey, v)}
                        disabled={mode === 'editor'}
                        className="inline-flex"
                      >
                        <RadioGroupItem
                          value={col}
                          id={`${element.id}-${rowKey}-${ci}`}
                          disabled={mode === 'editor'}
                          aria-label={`${row} – ${col}`}
                        />
                      </RadioGroup>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
