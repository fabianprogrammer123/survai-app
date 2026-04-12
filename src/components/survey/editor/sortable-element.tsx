'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SurveyElement } from '@/types/survey';
import { useSurveyStore } from '@/lib/survey/store';
import { getBlockTemplate } from '@/lib/templates/blocks';
import { ElementRenderer } from '@/components/survey/elements/element-renderer';
import { ElementTypeBadge } from './element-type-badge';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Returns true if a hex color is light (luminance > 0.5) */
function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.5;
}

/** Default accent colors assigned by element index for visual variety */
const ACCENT_PALETTE = [
  '#6366f1', // indigo
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#22c55e', // green
  '#f97316', // orange
];

interface Props {
  element: SurveyElement;
  index?: number;
  isDragOverlay?: boolean;
}

export function SortableElement({ element, index = 0, isDragOverlay }: Props) {
  const selectedId = useSurveyStore((s) => s.selectedElementId);
  const selectElement = useSurveyStore((s) => s.selectElement);
  const removeElement = useSurveyStore((s) => s.removeElement);
  const duplicateElement = useSurveyStore((s) => s.duplicateElement);
  const elementBlockMap = useSurveyStore((s) => s.elementBlockMap);
  const updateElement = useSurveyStore((s) => s.updateElement);
  const highlightedIds = useSurveyStore((s) => s.highlightedElementIds);
  const setHighlightedMessage = useSurveyStore((s) => s.setHighlightedMessage);
  const generationBatches = useSurveyStore((s) => s.generationBatches);
  const recentlyAddedIds = useSurveyStore((s) => s.recentlyAddedIds);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id, disabled: isDragOverlay });

  // Determine if a background color is "light" to flip text color for contrast
  const isLightBg = element.backgroundColor ? isLightColor(element.backgroundColor) : false;

  // Colorful left border accent — use element's own color or assign from palette
  const accentColor = element.accentColor || ACCENT_PALETTE[index % ACCENT_PALETTE.length];

  const style: React.CSSProperties = {
    transform: isDragOverlay ? undefined : CSS.Transform.toString(transform),
    transition: isDragOverlay ? undefined : transition,
    borderLeftColor: accentColor,
    ...(element.backgroundColor ? { backgroundColor: element.backgroundColor } : {}),
    ...(isLightBg ? { color: '#1a1a2e' } : {}),
  };

  const isSelected = selectedId === element.id;
  const isHighlighted = highlightedIds.includes(element.id);
  const isRecentlyAdded = recentlyAddedIds.includes(element.id);

  // Block source info
  const blockId = elementBlockMap[element.id];
  const blockTemplate = blockId ? getBlockTemplate(blockId) : null;

  // Find source message for reverse hover
  const sourceBatch = generationBatches.find((b) =>
    b.elementIds.includes(element.id)
  );

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={style}
      className={cn(
        'survey-card group relative rounded-xl border border-border/30 border-l-[3px] bg-card p-5 transition-all duration-200 cursor-pointer',
        'hover:border-border/60 hover:shadow-md hover:-translate-y-[1px]',
        isSelected && 'ring-2 ring-primary/80 border-primary shadow-lg shadow-primary/5',
        isHighlighted && 'ring-2 ring-indigo-400/60 shadow-[0_0_20px_rgba(129,140,248,0.2)] border-indigo-300/40',
        isDragging && !isDragOverlay && 'opacity-30',
        isDragOverlay && 'drag-overlay shadow-2xl',
        isRecentlyAdded && 'element-stream-in',
      )}
      onClick={(e) => {
        if (isDragOverlay) return;
        e.stopPropagation();
        selectElement(element.id, 'canvas');
      }}
      onMouseEnter={() => {
        if (isDragOverlay) return;
        if (sourceBatch) {
          setHighlightedMessage(sourceBatch.messageId);
        }
      }}
      onMouseLeave={() => {
        if (isDragOverlay) return;
        setHighlightedMessage(null);
      }}
    >
      {/* Element type badge — top-right, hidden on hover so actions can take its place */}
      <div className="absolute top-2 right-2 z-10 pointer-events-none group-hover:opacity-0 transition-opacity">
        <ElementTypeBadge type={element.type} />
      </div>

      {/* Question number badge — positioned inside the left padding area */}
      <span className="absolute top-3.5 left-4 text-[10px] font-mono text-muted-foreground/50 tabular-nums select-none">
        Q{index + 1}
      </span>

      {/* Block source badge */}
      {blockTemplate && (
        <Badge
          variant="outline"
          className="absolute bottom-2 right-2 text-[10px] h-5 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {blockTemplate.label}
        </Badge>
      )}

      {/* Drag handle */}
      {!isDragOverlay && (
        <button
          className="absolute -left-0.5 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 rounded-md hover:bg-muted/80"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Element content */}
      <div className="pl-5 pr-14">
        <ElementRenderer element={element} mode="editor" onUpdate={isDragOverlay ? undefined : (updates) => updateElement(element.id, updates)} />
      </div>

      {/* Action buttons */}
      {!isDragOverlay && (
        <div className="absolute right-3 top-3 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="p-1.5 rounded-md hover:bg-muted/80 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              duplicateElement(element.id);
            }}
            title="Duplicate"
          >
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              removeElement(element.id);
            }}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      )}
    </div>
  );
}
