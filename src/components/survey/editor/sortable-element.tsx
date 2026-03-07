'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SurveyElement } from '@/types/survey';
import { useSurveyStore } from '@/lib/survey/store';
import { ElementRenderer } from '@/components/survey/elements/element-renderer';
import { GripVertical, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  element: SurveyElement;
}

export function SortableElement({ element }: Props) {
  const selectedId = useSurveyStore((s) => s.selectedElementId);
  const selectElement = useSurveyStore((s) => s.selectElement);
  const removeElement = useSurveyStore((s) => s.removeElement);
  const duplicateElement = useSurveyStore((s) => s.duplicateElement);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isSelected = selectedId === element.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-lg border bg-card p-4 shadow-sm transition-all cursor-pointer',
        isSelected && 'ring-2 ring-primary border-primary',
        isDragging && 'opacity-50 shadow-lg',
      )}
      onClick={(e) => {
        e.stopPropagation();
        selectElement(element.id);
      }}
    >
      {/* Drag handle */}
      <button
        className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>

      {/* Element content */}
      <div className="pl-6">
        <ElementRenderer element={element} mode="editor" />
      </div>

      {/* Action buttons */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="p-1 rounded hover:bg-muted"
          onClick={(e) => {
            e.stopPropagation();
            duplicateElement(element.id);
          }}
        >
          <Copy className="h-4 w-4 text-muted-foreground" />
        </button>
        <button
          className="p-1 rounded hover:bg-muted"
          onClick={(e) => {
            e.stopPropagation();
            removeElement(element.id);
          }}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
