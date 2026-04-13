'use client';

import { useRouter } from 'next/navigation';
import { Pencil, BarChart3, Trash2 } from 'lucide-react';
import type { SurveyMeta } from '@/lib/survey/local-surveys';
import { formatRelativeDate } from '@/lib/survey/local-surveys';

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

      {/* Preview area — mini form skeleton */}
      <div className="relative h-28 bg-muted/10 border-b border-border/20 px-4 py-3 flex flex-col justify-center gap-2">
        {survey.elementCount > 0 ? (
          <>
            <div className="space-y-2.5">
              <div className="h-1.5 rounded-full w-[70%]" style={{ background: `${accent}30` }} />
              <div className="h-6 rounded-md bg-muted/40 w-full" />
            </div>
            {survey.elementCount > 1 && (
              <div className="space-y-2">
                <div className="h-1.5 rounded-full w-[55%]" style={{ background: `${accent}20` }} />
                <div className="h-6 rounded-md bg-muted/30 w-full" />
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-muted-foreground/50">Empty survey</p>
          </div>
        )}

        {/* Hover action overlay */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/test/edit?id=${survey.id}`); }}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Edit"
          >
            <Pencil className="h-4 w-4 text-white" />
            <span className="text-[10px] font-medium text-white/80">Edit</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/test/edit?id=${survey.id}`); }}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Insights"
          >
            <BarChart3 className="h-4 w-4 text-white" />
            <span className="text-[10px] font-medium text-white/80">Insights</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(survey.id); }}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-red-500/20 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4 text-white" />
            <span className="text-[10px] font-medium text-white/80">Delete</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3.5 py-3 flex items-center justify-between">
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
      </div>
    </div>
  );
}
