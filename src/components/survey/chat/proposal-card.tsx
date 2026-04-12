'use client';

import { useSurveyStore } from '@/lib/survey/store';
import { getCatalogEntry } from '@/lib/survey/catalog';
import { getBlockTemplate } from '@/lib/templates/blocks';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Proposal } from '@/types/survey';

interface ProposalCardProps {
  proposal: Proposal;
  index: number;
  onSelect: (proposal: Proposal) => void;
}

export function ProposalCard({ proposal, index, onSelect }: ProposalCardProps) {
  const MAX_VISIBLE = 3;
  const visibleElements = proposal.elements.slice(0, MAX_VISIBLE);
  const remainingCount = proposal.elements.length - MAX_VISIBLE;

  return (
    <button
      onClick={() => onSelect(proposal)}
      className={cn(
        'w-full text-left rounded-lg border bg-background/60 p-3 space-y-2',
        'hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer',
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

      {/* Compact element preview */}
      <div className="space-y-1 pt-1 border-t border-border/40">
        {visibleElements.map((el) => {
          const blockId = proposal.blockMap[el.id];
          const block = blockId ? getBlockTemplate(blockId) : null;
          const catalogEntry = block ? getCatalogEntry(block.elementType) : getCatalogEntry(el.type);
          const Icon = catalogEntry?.icon;

          return (
            <div key={el.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              {Icon && <Icon className="h-3 w-3 shrink-0" />}
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
    </button>
  );
}
