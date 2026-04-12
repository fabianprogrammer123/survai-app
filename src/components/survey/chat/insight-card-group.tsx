'use client';

import { useState } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { getCatalogEntry } from '@/lib/survey/catalog';
import { getBlockTemplate } from '@/lib/templates/blocks';
import { ChevronDown, ChevronRight, Info, Layers } from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { GenerationBatch } from '@/types/survey';

interface InsightCardGroupProps {
  batch: GenerationBatch;
}

export function InsightCardGroup({ batch }: InsightCardGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const setHighlightedElements = useSurveyStore((s) => s.setHighlightedElements);
  const selectElement = useSurveyStore((s) => s.selectElement);

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
              const catalogEntry = block ? getCatalogEntry(block.elementType) : null;
              const Icon = catalogEntry?.icon;

              return (
                <div
                  key={card.elementId}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent/50 transition-colors cursor-pointer"
                  onMouseEnter={() => setHighlightedElements([card.elementId])}
                  onMouseLeave={() => setHighlightedElements([])}
                  onClick={() => selectElement(card.elementId)}
                >
                  {Icon && (
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground/80 truncate block">
                      {card.elementTitle || card.blockLabel}
                    </span>
                  </div>
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
