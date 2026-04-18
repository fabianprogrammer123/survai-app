'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { RankingElement, SurveyElement } from '@/types/survey';
import { Label } from '@/components/ui/label';
import { ElementMode } from './element-renderer';
import { InlineEditable } from './inline-editable';

interface Props {
  element: RankingElement;
  mode: ElementMode;
  /** Ordered list of item labels (the respondent's answer). */
  value?: string[];
  onChange?: (value: string[]) => void;
  onUpdate?: (updates: Partial<SurveyElement>) => void;
}

function SortableItem({ id, label, index }: { id: string; label: string; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-border/40 bg-card px-3 py-2 text-sm cursor-grab active:cursor-grabbing hover:border-border/70 transition-colors"
      data-ranking-item="true"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="font-medium text-xs text-muted-foreground w-6 tabular-nums">
        {index + 1}.
      </span>
      <span className="flex-1 truncate">{label}</span>
    </li>
  );
}

export function RankingRenderer({ element, mode, value, onChange, onUpdate }: Props) {
  // Local order — seeded from value if present, otherwise from element.items.
  // We track both the order and a snapshot of the items array so we can
  // synchronously detect editor-side changes to items during render (preferred
  // over useEffect+setState, which is flagged as cascading-render).
  const [state, setState] = useState<{ order: string[]; itemsKey: string }>(() => ({
    order:
      value && value.length === element.items.length ? [...value] : [...element.items],
    itemsKey: element.items.join('\u0000'),
  }));

  // If a respondent answer (`value`) is not provided and the element's items
  // array has changed (editor added/removed/renamed items), re-seed order.
  const currentKey = element.items.join('\u0000');
  let order = state.order;
  if (!value && currentKey !== state.itemsKey) {
    order = [...element.items];
    setState({ order, itemsKey: currentKey });
  } else if (value && value.length === element.items.length && value.join('\u0000') !== order.join('\u0000')) {
    // External controlled value changed — respect it.
    order = [...value];
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.findIndex((x) => x === active.id);
    const newIndex = order.findIndex((x) => x === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(order, oldIndex, newIndex);
    setState({ order: newOrder, itemsKey: currentKey });
    onChange?.(newOrder);
  }

  return (
    <div className="space-y-2 group" data-ranking="true">
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {order.map((item, i) => (
              <SortableItem key={item} id={item} label={item} index={i} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
