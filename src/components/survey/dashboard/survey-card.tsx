'use client';

import { useRouter } from 'next/navigation';
import { Copy, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { SurveyMeta } from '@/lib/survey/local-surveys';
import { formatRelativeDate } from '@/lib/survey/local-surveys';
import { MiniFormPreview } from './mini-form-preview';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Accent color based on style preset
const ACCENT_COLORS: Record<string, string> = {
  'google-forms': '#673ab7',
  'typeform': '#e94560',
};

interface SurveyCardProps {
  survey: SurveyMeta;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SurveyCard({ survey, onDuplicate, onDelete }: SurveyCardProps) {
  const router = useRouter();
  const accent = ACCENT_COLORS[survey.stylePreset || 'google-forms'] || '#6366f1';

  return (
    <div
      onClick={() => router.push(`/test/edit?id=${survey.id}`)}
      className="group relative rounded-xl border border-border/50 bg-card overflow-hidden cursor-pointer transition-all duration-200 hover:border-border/80 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5"
    >
      {/* Accent top strip */}
      <div className="h-2" style={{ background: accent }} />

      {/* Preview area — actual mini form. No title is passed to the preview
          because the card footer already renders the survey title; showing
          it inside the preview too created a "double title" visual
          illusion. The preview uses 'real' mode so the user sees each
          question's actual text and type-shaped input stub instead of
          abstract silhouette bars. */}
      <div className="relative h-32 bg-gray-100 border-b border-border/20 overflow-hidden">
        <MiniFormPreview
          questions={survey.preview?.questions ?? []}
          accentColor={accent}
          bgColor="#f6f8fb"
          mode="real"
        />
      </div>

      {/* Footer */}
      <div className="px-3.5 py-3 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{survey.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">{formatRelativeDate(survey.updatedAt)}</span>
            {survey.published ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                Live
              </span>
            ) : (
              <span className="text-[10px] font-medium text-muted-foreground/60">Draft</span>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 p-1.5 rounded-md hover:bg-muted/60 transition-colors outline-none"
            title="More actions"
          >
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); router.push(`/test/edit?id=${survey.id}`); }}
            >
              <Pencil className="h-4 w-4 mr-2" /> Open
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onDuplicate(survey.id); }}
            >
              <Copy className="h-4 w-4 mr-2" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(survey.id); }}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
