'use client';

import type { LucideIcon } from 'lucide-react';
import {
  AlignLeft,
  Type,
  CircleDot,
  CheckSquare,
  ChevronDown,
  SlidersHorizontal,
  Calendar,
  Upload,
  Hash,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_ICONS: Record<string, LucideIcon> = {
  short_text: Type,
  long_text: AlignLeft,
  multiple_choice: CircleDot,
  checkboxes: CheckSquare,
  dropdown: ChevronDown,
  linear_scale: SlidersHorizontal,
  date: Calendar,
  file_upload: Upload,
  section_header: Hash,
  page_break: MoreHorizontal,
};

export interface PreviewQuestion {
  title: string;
  type: string;
}

interface Props {
  title: string;
  questions: PreviewQuestion[];
  accentColor: string;
  bgColor?: string;
  className?: string;
}

export function MiniFormPreview({ title, questions, accentColor, bgColor, className }: Props) {
  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden rounded-lg',
        className
      )}
      style={{ background: bgColor || '#ffffff' }}
    >
      {/* Accent top band */}
      <div className="h-1.5 w-full" style={{ background: accentColor }} />

      <div className="px-3 py-2.5 space-y-2">
        {/* Title */}
        <div
          className="text-[9px] font-semibold leading-tight line-clamp-2"
          style={{ color: '#1a1a1f' }}
        >
          {title || 'Untitled Form'}
        </div>

        {/* Question rows */}
        <div className="space-y-1.5">
          {questions.slice(0, 3).map((q, i) => {
            const Icon = TYPE_ICONS[q.type] || Type;
            return (
              <div key={i} className="flex items-center gap-1.5">
                <Icon className="h-2 w-2 shrink-0" style={{ color: accentColor, opacity: 0.6 }} />
                <div
                  className="h-0.5 rounded-full flex-1"
                  style={{ background: `${accentColor}33` }}
                />
              </div>
            );
          })}
          {questions.length === 0 && (
            <div className="text-[8px] text-gray-400">No questions yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
