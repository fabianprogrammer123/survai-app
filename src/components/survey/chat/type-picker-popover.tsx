'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { QUESTION_TYPES } from '@/lib/survey/type-conversion';
import { cn } from '@/lib/utils';
import type { ElementType } from '@/types/survey';

interface TypePickerPopoverProps {
  currentType: ElementType;
  onSelect: (type: ElementType) => void;
  children: React.ReactNode;
  /** Stop click/keyboard events from bubbling to parent interactive elements. */
  stopPropagation?: boolean;
  className?: string;
}

/**
 * A compact question-type picker used from the chat rail (insight cards and
 * proposal previews). Clicking any icon opens this menu, and selection maps
 * through the same `buildTypeConversion` logic the properties panel uses.
 */
export function TypePickerPopover({
  currentType,
  onSelect,
  children,
  stopPropagation = false,
  className,
}: TypePickerPopoverProps) {
  const categories = {
    text: { label: 'Text', entries: QUESTION_TYPES.filter((c) => c.category === 'text') },
    choice: { label: 'Choice', entries: QUESTION_TYPES.filter((c) => c.category === 'choice') },
    other: { label: 'Other', entries: QUESTION_TYPES.filter((c) => c.category === 'other') },
  } as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex items-center justify-center rounded-md outline-none transition-colors',
          'hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/40',
          className
        )}
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation();
        }}
        onKeyDown={(e) => {
          if (stopPropagation) e.stopPropagation();
        }}
        aria-label="Change question type"
      >
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        {Object.entries(categories).map(([key, { label, entries }], i) => {
          if (entries.length === 0) return null;
          return (
            <div key={key}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide">
                  {label}
                </DropdownMenuLabel>
                {entries.map((entry) => {
                  const Icon = entry.icon;
                  const isCurrent = entry.type === currentType;
                  return (
                    <DropdownMenuItem
                      key={entry.type}
                      onClick={(e) => {
                        if (stopPropagation) e.stopPropagation();
                        if (!isCurrent) onSelect(entry.type);
                      }}
                      className={cn(isCurrent && 'bg-primary/10 text-primary font-medium')}
                    >
                      <Icon className="mr-2 h-3.5 w-3.5" />
                      {entry.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
