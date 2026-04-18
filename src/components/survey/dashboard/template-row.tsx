'use client';

import { SURVEY_TEMPLATES } from '@/lib/templates/surveys';
import { getBlockTemplate } from '@/lib/templates/blocks';
import { Plus } from 'lucide-react';
import { MiniFormPreview } from './mini-form-preview';

// Cycle through a pleasant palette for template accent colors, derived by index.
// Inspired by Google's material accent palette used on Forms template cards.
const ACCENT_PALETTE = [
  '#673ab7', // purple
  '#0b8043', // green
  '#4285f4', // blue
  '#e37400', // orange
  '#db4437', // red
  '#3367d6', // deep blue
];

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
    <section className="px-3 sm:px-6 py-6">
      <h2 className="text-sm font-medium text-muted-foreground mb-4">Start a new form</h2>

      <div className="flex gap-4 overflow-x-auto py-2 -mx-1 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* Blank form card */}
        <button
          onClick={() => onTemplateSelect('blank')}
          className="shrink-0 w-[120px] sm:w-[150px] h-[150px] sm:h-[180px] rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/80 to-purple-600/80 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 hover:border-indigo-400/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/10"
        >
          <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
            <Plus className="h-7 w-7 text-white" />
          </div>
          <span className="text-sm font-medium text-white">Blank form</span>
        </button>

        {/* Template cards */}
        {filtered.map((template, idx) => {
          // Derive preview questions: resolve each block reference to its block
          // template, apply overrides, and collect the first three that have a
          // real question-like type (skip section headers / page breaks if possible).
          const previewQuestions: { title: string; type: string }[] = template.blocks
            .map((b) => {
              const block = getBlockTemplate(b.blockId);
              if (!block) return null;
              const title = b.overrides?.title ?? block.defaults.title ?? '';
              const type: string = block.elementType ?? 'short_text';
              return { title, type };
            })
            .filter((q): q is { title: string; type: string } => q !== null)
            .filter((q) => q.type !== 'section_header' && q.type !== 'page_break')
            .slice(0, 3);

          const accentColor = ACCENT_PALETTE[idx % ACCENT_PALETTE.length];

          return (
            <button
              key={template.templateId}
              onClick={() => onTemplateSelect(template.templateId)}
              className="shrink-0 w-[120px] sm:w-[150px] h-[150px] sm:h-[180px] rounded-xl border border-border/50 bg-card overflow-hidden cursor-pointer transition-all duration-200 hover:border-primary/40 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/15"
            >
              {/* Preview takes top portion */}
              <div className="h-[105px] sm:h-[130px] bg-background">
                <MiniFormPreview
                  title={template.label}
                  questions={previewQuestions}
                  accentColor={accentColor}
                  bgColor="#f6f8fb"
                />
              </div>
              {/* Footer */}
              <div className="px-2.5 py-2 flex flex-col">
                <p className="text-xs font-medium text-foreground line-clamp-1 text-left">{template.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 text-left">{template.estimatedTime}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
