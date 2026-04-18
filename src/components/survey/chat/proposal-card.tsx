'use client';

import { useState, useMemo } from 'react';
import { getCatalogEntry } from '@/lib/survey/catalog';
import { buildTypeConversion } from '@/lib/survey/type-conversion';
import { TypePickerPopover } from './type-picker-popover';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ElementType, Proposal, SurveyElement } from '@/types/survey';

interface ProposalCardProps {
  proposal: Proposal;
  index: number;
  onSelect: (proposal: Proposal) => void;
}

export function ProposalCard({ proposal, index, onSelect }: ProposalCardProps) {
  const MAX_VISIBLE = 3;

  // Keep a local mutable copy of the proposal's elements so clicking the
  // icon on a preview row can change that question's type before the user
  // commits the proposal. When Select fires, we hand back the amended copy.
  const [elements, setElements] = useState<SurveyElement[]>(proposal.elements);
  const visibleElements = elements.slice(0, MAX_VISIBLE);
  const remainingCount = elements.length - MAX_VISIBLE;

  const workingProposal = useMemo<Proposal>(
    () => ({ ...proposal, elements }),
    [proposal, elements]
  );

  function handleTypeChange(elementId: string, newType: ElementType) {
    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== elementId || el.type === newType) return el;
        const patch = buildTypeConversion(el, newType);
        return { ...el, ...patch } as SurveyElement;
      })
    );
  }

  function handleSelect() {
    onSelect(workingProposal);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        'w-full text-left rounded-lg border bg-background/60 p-3 space-y-2',
        'hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        'group'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-xs font-semibold text-primary/80">
            Option {String.fromCharCode(65 + index)}
          </span>
          <h4 className="text-sm font-medium leading-snug">{proposal.label}</h4>
        </div>
        <div className="shrink-0 h-6 w-6 rounded-full border-2 border-muted-foreground/20 group-hover:border-primary/60 flex items-center justify-center transition-colors">
          <Check className="h-3 w-3 text-primary/0 group-hover:text-primary/60 transition-colors" />
        </div>
      </div>

      {proposal.description && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {proposal.description}
        </p>
      )}

      {/* Compact element preview. Each icon is an inline type picker so the
          user can tune question types before committing the proposal. */}
      <div className="space-y-1 pt-1 border-t border-border/40">
        {visibleElements.map((el) => {
          const catalogEntry = getCatalogEntry(el.type);
          const Icon = catalogEntry?.icon;

          return (
            <div key={el.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              {Icon && (
                <TypePickerPopover
                  currentType={el.type}
                  onSelect={(t) => handleTypeChange(el.id, t)}
                  stopPropagation
                  className="h-5 w-5 shrink-0"
                >
                  <Icon className="h-3 w-3" />
                </TypePickerPopover>
              )}
              <span className="truncate">{el.title}</span>
            </div>
          );
        })}
        {remainingCount > 0 && (
          <span className="text-[10px] text-muted-foreground/60 pl-5">
            +{remainingCount} more element{remainingCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
