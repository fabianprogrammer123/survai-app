'use client';

import { useSurveyStore } from '@/lib/survey/store';
import { BLOCK_TEMPLATES, getBlockTemplate } from '@/lib/templates/blocks';
import { hydrateBlueprint } from '@/lib/templates/hydrate';
import type { BlockCategory } from '@/lib/templates/types';
import { getCatalogEntry } from '@/lib/survey/catalog';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

const CATEGORY_LABELS: Record<BlockCategory, string> = {
  demographics: 'Demographics',
  satisfaction: 'Ratings',
  feedback: 'Feedback',
  behavioral: 'Choices',
  data: 'Data',
  layout: 'Layout',
};

const CATEGORY_ORDER: BlockCategory[] = [
  'satisfaction',
  'feedback',
  'behavioral',
  'demographics',
  'data',
  'layout',
];

export function BlockPalette({ className }: Props) {
  const addElement = useSurveyStore((s) => s.addElement);
  const addBlockMapping = useSurveyStore((s) => s.addBlockMapping);

  function handleAddBlock(blockId: string) {
    const result = hydrateBlueprint({
      title: '',
      description: '',
      blocks: [{ blockId }],
    });
    if (result.elements.length > 0) {
      const el = result.elements[0];
      addElement(el);
      addBlockMapping(el.id, blockId);
    }
  }

  const grouped: Record<string, typeof BLOCK_TEMPLATES> = {};
  for (const block of BLOCK_TEMPLATES) {
    (grouped[block.category] ??= []).push(block);
  }

  return (
    <div className={cn('overflow-y-auto', className)}>
      <div className="px-4 py-3 border-b shrink-0">
        <h2 className="text-sm font-semibold">Blocks</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Click to add to survey</p>
      </div>
      <div className="p-2 space-y-3">
        {CATEGORY_ORDER.map((category) => {
          const blocks = grouped[category];
          if (!blocks) return null;
          return (
            <div key={category}>
              <p className="text-[10px] font-medium uppercase text-muted-foreground px-2 mb-1">
                {CATEGORY_LABELS[category]}
              </p>
              <div className="space-y-0.5">
                {blocks.map((block) => {
                  const catalogEntry = getCatalogEntry(block.elementType);
                  const Icon = catalogEntry?.icon;
                  return (
                    <button
                      key={block.blockId}
                      onClick={() => handleAddBlock(block.blockId)}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-sm"
                      title={block.description}
                    >
                      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span className="truncate">{block.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
