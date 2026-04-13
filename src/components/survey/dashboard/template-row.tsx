'use client';

import { SURVEY_TEMPLATES } from '@/lib/templates/surveys';
import {
  Smile,
  Users,
  Calendar,
  Package,
  Search,
  GraduationCap,
  Globe,
  DoorOpen,
  MessageSquare,
  Plus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Smile,
  Users,
  Calendar,
  Package,
  Search,
  GraduationCap,
  Globe,
  DoorOpen,
  MessageSquare,
  Plus,
};

interface TemplateRowProps {
  onTemplateSelect: (templateId: string) => void;
  searchQuery: string;
}

export function TemplateRow({ onTemplateSelect, searchQuery }: TemplateRowProps) {
  const templates = SURVEY_TEMPLATES.filter((t) => t.templateId !== 'blank');

  const filtered = searchQuery
    ? templates.filter(
        (t) =>
          t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : templates;

  return (
    <section className="rounded-2xl bg-muted/20 border border-border/20 px-6 py-6">
      <h2 className="text-sm font-medium text-muted-foreground mb-4">Start a new form</h2>

      <div className="flex gap-4 overflow-x-auto py-2 -mx-1 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* Blank form card */}
        <button
          onClick={() => onTemplateSelect('blank')}
          className="shrink-0 w-[150px] h-[180px] rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/80 to-purple-600/80 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 hover:border-indigo-400/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/10"
        >
          <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
            <Plus className="h-7 w-7 text-white" />
          </div>
          <span className="text-sm font-medium text-white">Blank form</span>
        </button>

        {/* Template cards */}
        {filtered.map((template) => {
          const Icon = ICON_MAP[template.icon] || MessageSquare;
          return (
            <button
              key={template.templateId}
              onClick={() => onTemplateSelect(template.templateId)}
              className="shrink-0 w-[150px] h-[180px] rounded-xl border border-border/50 bg-card flex flex-col items-center justify-center gap-2.5 px-3 cursor-pointer transition-all duration-200 hover:border-primary/40 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/15"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-foreground line-clamp-1">{template.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{template.estimatedTime}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
