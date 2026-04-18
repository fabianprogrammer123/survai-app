'use client';

import { useState } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { getCatalogEntry } from '@/lib/survey/catalog';
import { getBlockTemplate } from '@/lib/templates/blocks';
import { buildTypeConversion } from '@/lib/survey/type-conversion';
import { scrollToEditorElement } from '@/lib/survey/scroll';
import { TypePickerPopover } from './type-picker-popover';
import { ChevronDown, ChevronRight, Info, Layers } from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import type { GenerationBatch, ElementType } from '@/types/survey';

interface InsightCardGroupProps {
  batch: GenerationBatch;
}

export function InsightCardGroup({ batch }: InsightCardGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const setHighlightedElements = useSurveyStore((s) => s.setHighlightedElements);
  const selectElement = useSurveyStore((s) => s.selectElement);
  const updateElement = useSurveyStore((s) => s.updateElement);
  const elements = useSurveyStore((s) => s.survey.elements);

  function handleJumpTo(elementId: string) {
    selectElement(elementId, 'ai');
    scrollToEditorElement(elementId);
  }

  function handleTypeChange(elementId: string, newType: ElementType) {
    const source = elements.find((el) => el.id === elementId);
    if (!source || source.type === newType) return;
    updateElement(elementId, buildTypeConversion(source, newType));
  }

  return (
    <div className="mt-1.5 rounded-lg border bg-background/80 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Layers className="h-3 w-3" />
        <span>{batch.insightCards.length} elements created</span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 ml-auto" />
        ) : (
          <ChevronRight className="h-3 w-3 ml-auto" />
        )}
      </button>

      {expanded && (
        <div className="border-t">
          <TooltipProvider>
            {batch.insightCards.map((card) => {
              const block = getBlockTemplate(card.blockId);
              const liveElement = elements.find((el) => el.id === card.elementId);
              // Prefer the live (current) type so switching via the picker
              // updates the icon without waiting for a new generation batch.
              const currentType = liveElement?.type ?? block?.elementType;
              const catalogEntry = currentType ? getCatalogEntry(currentType) : null;
              const Icon = catalogEntry?.icon;

              return (
                <div
                  key={card.elementId}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent/50 transition-colors"
                  onMouseEnter={() => setHighlightedElements([card.elementId])}
                  onMouseLeave={() => setHighlightedElements([])}
                >
                  {Icon && liveElement ? (
                    <TypePickerPopover
                      currentType={liveElement.type}
                      onSelect={(t) => handleTypeChange(card.elementId, t)}
                      className="h-5 w-5 shrink-0"
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </TypePickerPopover>
                  ) : (
                    Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <button
                    type="button"
                    onClick={() => handleJumpTo(card.elementId)}
                    className="flex-1 min-w-0 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"
                    title="Jump to this question in the editor"
                  >
                    <span className="font-medium text-foreground/80 truncate block">
                      {card.elementTitle || card.blockLabel}
                    </span>
                  </button>
                  {card.rationale && (
                    <Tooltip>
                      <TooltipTrigger className="shrink-0">
                        <Info className="h-3 w-3 text-muted-foreground/60 hover:text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[220px]">
                        {card.rationale}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              );
            })}
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
