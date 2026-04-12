'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
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
import { ElementRenderer } from '@/components/survey/elements/element-renderer';
import { ResultsPanel } from '@/components/survey/results/results-panel';
import { VoiceInterview } from '@/components/survey/voice-interview';
import { SurveyThemeProvider } from '@/components/survey/theme-provider';
import { cn } from '@/lib/utils';

/** Returns true if a hex color is light (luminance > 0.5) */
function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.5;
}

interface Props {
  className?: string;
}

export function EditorCanvas({ className }: Props) {
  const elements = useSurveyStore((s) => s.survey.elements);
  const backgroundImage = useSurveyStore((s) => s.survey.settings.backgroundImage);
  const visualEffect = useSurveyStore((s) => s.survey.settings.visualEffect);
  const fontFamily = useSurveyStore((s) => s.survey.settings.fontFamily);
  const editorMode = useSurveyStore((s) => s.editorMode);
  const reorderElements = useSurveyStore((s) => s.reorderElements);
  const selectElement = useSurveyStore((s) => s.selectElement);

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = elements.findIndex((el) => el.id === active.id);
    const newIndex = elements.findIndex((el) => el.id === over.id);
    reorderElements(oldIndex, newIndex);
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  const activeElement = activeId ? elements.find((el) => el.id === activeId) : null;
  const activeIndex = activeId ? elements.findIndex((el) => el.id === activeId) : -1;

  // Results mode — render the results panel instead
  if (editorMode === 'results') {
    return <ResultsPanel className={cn('bg-muted/30', className)} aiEndpoint="/api/ai/results" />;
  }

  return (
    <div
      className={cn('relative overflow-hidden overflow-y-auto p-8 bg-muted/30', className)}
      onClick={(e) => {
        if (e.target === e.currentTarget) selectElement(null);
      }}
    >
      {backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-15 pointer-events-none"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      )}
      {visualEffect && visualEffect !== 'none' && (
        <div className={`absolute inset-0 pointer-events-none effect-${visualEffect}`} />
      )}
      <SurveyThemeProvider className="relative mx-auto max-w-2xl space-y-4">
        <SurveyHeaderCard />

        {editorMode === 'preview' ? (
          <>
            {/* Voice interview — ElevenLabs Conversational AI */}
            {elements.length > 0 && (
              <VoiceInterview />
            )}

            {/* Preview mode: render elements without editing capabilities */}
            {elements.map((element) => {
              const lightBg = element.backgroundColor ? isLightColor(element.backgroundColor) : false;
              return (
                <div
                  key={element.id}
                  className="survey-card rounded-xl border border-border/30 bg-card p-5 shadow-sm"
                  style={{
                    ...(element.accentColor ? { borderColor: element.accentColor } : {}),
                    ...(element.backgroundColor ? { backgroundColor: element.backgroundColor } : {}),
                    ...(lightBg ? { color: '#1a1a2e' } : {}),
                  }}
                >
                  <ElementRenderer element={element} mode="preview" />
                </div>
              );
            })}
          </>
        ) : (
          /* Editor mode: drag-and-drop sortable elements */
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext
                items={elements.map((el) => el.id)}
                strategy={verticalListSortingStrategy}
              >
                {elements.map((element, i) => (
                  <SortableElement key={element.id} element={element} index={i} />
                ))}
              </SortableContext>

              <DragOverlay dropAnimation={null}>
                {activeElement ? (
                  <SortableElement
                    element={activeElement}
                    index={activeIndex}
                    isDragOverlay
                  />
                ) : null}
              </DragOverlay>
            </DndContext>

            <AddElementButton />
          </>
        )}
      </SurveyThemeProvider>
    </div>
  );
}
