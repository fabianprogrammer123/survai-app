'use client';

import { MatrixMultiElement, SurveyElement } from '@/types/survey';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ElementMode } from './element-renderer';
import { InlineEditable } from './inline-editable';

interface Props {
  element: MatrixMultiElement;
  mode: ElementMode;
  value?: Record<string, string[]>;
  onChange?: (value: Record<string, string[]>) => void;
  onUpdate?: (updates: Partial<SurveyElement>) => void;
}

export function MatrixMultiRenderer({ element, mode, value = {}, onChange, onUpdate }: Props) {
  function toggleCell(rowKey: string, col: string, checked: boolean) {
    if (!onChange) return;
    const current = value[rowKey] ?? [];
    const next = checked ? [...current, col] : current.filter((c) => c !== col);
    onChange({ ...value, [rowKey]: next });
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

      <div className="overflow-x-auto -mx-2 px-2" data-matrix-multi>
        <table className="w-full text-sm border-collapse min-w-[420px]">
          <thead>
            <tr>
              <th className="text-left pb-2 pr-3 font-normal text-muted-foreground"></th>
              {element.columns.map((col, ci) => (
                <th
                  key={ci}
                  className="pb-2 px-2 font-normal text-xs text-muted-foreground text-center"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {element.rows.map((row, ri) => {
              const rowKey = `row-${ri}`;
              const rowSelection = value[rowKey] ?? [];
              return (
                <tr key={ri} className="border-t border-border/40">
                  <td className="py-2 pr-3 text-sm">{row}</td>
                  {element.columns.map((col, ci) => (
                    <td key={ci} className="py-2 px-2 text-center">
                      <Checkbox
                        id={`${element.id}-${rowKey}-${ci}`}
                        checked={rowSelection.includes(col)}
                        onCheckedChange={(checked) => toggleCell(rowKey, col, !!checked)}
                        disabled={mode === 'editor'}
                        aria-label={`${row} – ${col}`}
                      />
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
