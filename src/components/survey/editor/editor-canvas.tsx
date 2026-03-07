'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSurveyStore } from '@/lib/survey/store';
import { SortableElement } from './sortable-element';
import { AddElementButton } from './add-element-button';
import { SurveyHeaderCard } from './survey-header-card';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

export function EditorCanvas({ className }: Props) {
  const elements = useSurveyStore((s) => s.survey.elements);
  const reorderElements = useSurveyStore((s) => s.reorderElements);
  const selectElement = useSurveyStore((s) => s.selectElement);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = elements.findIndex((el) => el.id === active.id);
    const newIndex = elements.findIndex((el) => el.id === over.id);
    reorderElements(oldIndex, newIndex);
  }

  return (
    <div
      className={cn('overflow-y-auto p-6 bg-muted/30', className)}
      onClick={(e) => {
        if (e.target === e.currentTarget) selectElement(null);
      }}
    >
      <div className="mx-auto max-w-2xl space-y-3">
        <SurveyHeaderCard />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={elements.map((el) => el.id)}
            strategy={verticalListSortingStrategy}
          >
            {elements.map((element) => (
              <SortableElement key={element.id} element={element} />
            ))}
          </SortableContext>
        </DndContext>

        <AddElementButton />

        {elements.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">No questions yet</p>
            <p className="text-sm mt-1">
              Use the chat to describe your survey, or add questions manually below
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
