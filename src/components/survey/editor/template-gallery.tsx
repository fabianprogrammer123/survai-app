'use client';

import { useSurveyStore } from '@/lib/survey/store';
import { SURVEY_TEMPLATES } from '@/lib/templates/surveys';
import { hydrateSurveyTemplate } from '@/lib/templates/hydrate';
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

export function TemplateGallery() {
  const setSurvey = useSurveyStore((s) => s.setSurvey);
  const survey = useSurveyStore((s) => s.survey);
  const applyGeneration = useSurveyStore((s) => s.applyGeneration);

  function handleSelect(templateId: string) {
    const template = SURVEY_TEMPLATES.find((t) => t.templateId === templateId);
    if (!template) return;

    if (template.templateId === 'blank') return; // blank = do nothing

    const result = hydrateSurveyTemplate(
      template.blocks,
      template.label,
      template.description
    );

    applyGeneration({
      survey: {
        title: result.title,
        description: result.description,
        elements: result.elements,
        settings: result.settings,
      },
      blockMap: result.blockMap,
    });
  }

  return (
    <div className="py-8 px-4">
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold">Start with a template</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a starting point, or describe your survey in the chat
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
        {SURVEY_TEMPLATES.filter((t) => t.templateId !== 'blank').map((template) => {
          const Icon = ICON_MAP[template.icon] || MessageSquare;
          return (
            <button
              key={template.templateId}
              onClick={() => handleSelect(template.templateId)}
              className="flex flex-col items-start gap-2 p-4 rounded-lg border bg-card hover:border-primary hover:shadow-sm transition-all text-left"
            >
              <Icon className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">{template.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {template.description}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {template.blocks.length} questions &middot; {template.estimatedTime}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
