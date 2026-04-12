'use client';

import { CATALOG } from '@/lib/survey/catalog';
import type { ElementType } from '@/types/survey';
import { HelpCircle } from 'lucide-react';

interface Props {
  type: ElementType;
}

export function ElementTypeBadge({ type }: Props) {
  const entry = CATALOG.find((c) => c.type === type);
  if (!entry) return null;

  const Icon = entry.icon ?? HelpCircle;

  return (
    <div
      className="flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
      data-element-type-badge={type}
    >
      <Icon className="h-3 w-3" />
      {entry.label}
    </div>
  );
}
