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

export type MiniFormPreviewMode = 'silhouette' | 'real';

interface Props {
  /**
   * Optional form title rendered above the question list. When omitted,
   * the title block is not rendered at all — used by dashboard survey
   * cards whose footer already shows the title, avoiding a visual
   * "double title" inside and below the preview area.
   */
  title?: string;
  questions: PreviewQuestion[];
  accentColor: string;
  bgColor?: string;
  className?: string;
  /**
   * 'silhouette' (default): abstract bars per question — right for
   * template thumbnails.
   * 'real': renders each question's real title text plus a type-shaped
   * input stub — used on Recent-forms cards so the user sees their
   * actual survey content in the thumbnail.
   */
  mode?: MiniFormPreviewMode;
}

export function MiniFormPreview({
  title,
  questions,
  accentColor,
  bgColor,
  className,
  mode = 'silhouette',
}: Props) {
  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden rounded-lg',
        className
      )}
      style={{ background: bgColor || '#ffffff' }}
      data-preview-mode={mode}
    >
      {/* Accent top band */}
      <div className="h-1.5 w-full" style={{ background: accentColor }} />

      <div className="px-3 py-2.5 space-y-2">
        {/* Title — only rendered when explicitly provided */}
        {title ? (
          <div
            className="text-[9px] font-semibold leading-tight line-clamp-2"
            style={{ color: '#1a1a1f' }}
          >
            {title}
          </div>
        ) : null}

        {/* Question rows */}
        {mode === 'silhouette' ? (
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
        ) : (
          <div className="space-y-2">
            {questions.slice(0, 3).map((q, i) => (
              <RealQuestionRow key={i} question={q} accentColor={accentColor} />
            ))}
            {questions.length === 0 && (
              <div className="text-[8px] text-gray-400">No questions yet</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Renders a single question in "real" mode: the actual question title
 * plus a type-appropriate input stub. Sizes are intentionally tiny
 * (text-[9px] / text-[8px]) so 3 rows fit inside a ~h-32 thumbnail.
 */
function RealQuestionRow({
  question,
  accentColor,
}: {
  question: PreviewQuestion;
  accentColor: string;
}) {
  const labelClass = 'text-[9px] font-medium leading-tight line-clamp-1';
  const labelStyle = { color: '#1a1a1f' };
  const stubBorder = '1px solid #d6dae0';

  return (
    <div className="space-y-1">
      <div className={labelClass} style={labelStyle}>
        {question.title || 'Untitled question'}
      </div>
      <QuestionStub type={question.type} accentColor={accentColor} stubBorder={stubBorder} />
    </div>
  );
}

function QuestionStub({
  type,
  accentColor,
  stubBorder,
}: {
  type: string;
  accentColor: string;
  stubBorder: string;
}) {
  switch (type) {
    case 'long_text':
      return (
        <div
          className="h-3 w-full rounded"
          style={{ border: stubBorder, background: '#ffffff' }}
        />
      );
    case 'multiple_choice':
      return (
        <div className="space-y-0.5">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-1">
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ border: `1px solid ${accentColor}88` }}
              />
              <span className="text-[8px] text-gray-500">Option {i + 1}</span>
            </div>
          ))}
        </div>
      );
    case 'checkboxes':
      return (
        <div className="space-y-0.5">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-1">
              <span
                className="h-1.5 w-1.5 rounded-[1px] shrink-0"
                style={{ border: `1px solid ${accentColor}88` }}
              />
              <span className="text-[8px] text-gray-500">Option {i + 1}</span>
            </div>
          ))}
        </div>
      );
    case 'dropdown':
      return (
        <div
          className="h-2.5 w-full rounded flex items-center justify-between px-1"
          style={{ border: stubBorder, background: '#ffffff' }}
        >
          <span className="text-[7px] text-gray-400">Choose...</span>
          <ChevronDown className="h-2 w-2 text-gray-400 shrink-0" />
        </div>
      );
    case 'linear_scale':
      return (
        <div className="flex items-center justify-between gap-1">
          <span className="text-[7px] text-gray-500">Low</span>
          <div className="flex items-center gap-[3px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={{ border: `1px solid ${accentColor}88` }}
              />
            ))}
          </div>
          <span className="text-[7px] text-gray-500">High</span>
        </div>
      );
    case 'date':
      return (
        <div
          className="h-2.5 w-full rounded flex items-center justify-between px-1"
          style={{ border: stubBorder, background: '#ffffff' }}
        >
          <span className="text-[7px] text-gray-400">mm / dd / yyyy</span>
          <Calendar className="h-2 w-2 text-gray-400 shrink-0" />
        </div>
      );
    case 'section_header':
      return (
        <div
          className="h-px w-full"
          style={{ background: `${accentColor}44` }}
        />
      );
    case 'page_break':
      return (
        <div className="flex items-center justify-center">
          <MoreHorizontal className="h-2 w-2 text-gray-400" />
        </div>
      );
    case 'file_upload':
      return (
        <div
          className="h-3 w-full rounded flex items-center justify-center"
          style={{ border: `1px dashed #c4c9d0`, background: '#fafbfc' }}
        >
          <Upload className="h-2 w-2 text-gray-400" />
        </div>
      );
    case 'short_text':
    default:
      return (
        <div
          className="h-2.5 w-full rounded"
          style={{ border: stubBorder, background: '#ffffff' }}
        />
      );
  }
}
