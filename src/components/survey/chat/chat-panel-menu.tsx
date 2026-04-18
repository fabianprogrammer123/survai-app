'use client';

import { useSurveyStore } from '@/lib/survey/store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Info } from 'lucide-react';

/**
 * Tiny floating kebab at the top-right of the chat panel. Currently houses
 * the AI Inspector toggle; intentionally minimal so future entries (e.g.
 * 'clear conversation', 'export trace') can slot in without layout churn.
 */
export function ChatPanelMenu() {
  const inspectorEnabled = useSurveyStore((s) => s.inspectorEnabled);
  const setInspectorEnabled = useSurveyStore((s) => s.setInspectorEnabled);

  return (
    <div className="absolute right-2 top-2 z-10">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Chat panel menu"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4} className="w-56">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Developer
          </div>
          <DropdownMenuCheckboxItem
            checked={inspectorEnabled}
            onCheckedChange={(v) => setInspectorEnabled(Boolean(v))}
          >
            <Info className="mr-2 h-3.5 w-3.5" />
            AI Inspector
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
