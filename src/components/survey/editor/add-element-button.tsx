'use client';

import { CATALOG } from '@/lib/survey/catalog';
import { useSurveyStore } from '@/lib/survey/store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export function AddElementButton() {
  const addElement = useSurveyStore((s) => s.addElement);

  const addable = CATALOG.filter((e) => !e.hidden);
  const categories = {
    text: { label: 'Text', entries: addable.filter((c) => c.category === 'text') },
    choice: { label: 'Choice', entries: addable.filter((c) => c.category === 'choice') },
    other: { label: 'Other', entries: addable.filter((c) => c.category === 'other') },
    layout: { label: 'Layout', entries: addable.filter((c) => c.category === 'layout') },
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full inline-flex items-center justify-center rounded-xl border border-dashed border-border/40 bg-card/50 px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground hover:border-border/70 transition-all duration-200">
        <Plus className="mr-2 h-4 w-4" /> Add Question
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="center">
        {Object.entries(categories).map(([key, { label, entries }], i) => (
          <div key={key}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuLabel>{label}</DropdownMenuLabel>
              {entries.map((entry) => {
                const Icon = entry.icon;
                return (
                  <DropdownMenuItem
                    key={entry.type}
                    onClick={() => addElement(entry.defaultElement())}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {entry.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
