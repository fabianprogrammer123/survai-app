'use client';

import { useSurveyStore } from '@/lib/survey/store';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const ACCENT_MAP: Record<string, string> = {
  'google-forms': '#673ab7',
  'typeform': '#e94560',
};

export function SurveyHeaderCard() {
  const title = useSurveyStore((s) => s.survey.title);
  const description = useSurveyStore((s) => s.survey.description);
  const stylePreset = useSurveyStore((s) => s.survey.settings.stylePreset) || 'google-forms';
  const setTitle = useSurveyStore((s) => s.setTitle);
  const setDescription = useSurveyStore((s) => s.setDescription);

  const accentColor = ACCENT_MAP[stylePreset] || '#673ab7';

  return (
    <div className="survey-card rounded-xl border border-border/30 bg-card p-6 border-t-[3px] shadow-sm" style={{ borderTopColor: accentColor }}>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="font-sans border-none text-2xl font-bold p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/30 rounded-lg px-3 -mx-3 py-1 transition-colors"
        placeholder="Untitled Survey"
      />
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="font-sans border-none text-muted-foreground p-0 mt-1 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[36px] hover:bg-muted/30 rounded-lg px-3 -mx-3 py-1 transition-colors"
        placeholder="Add a description..."
        rows={2}
      />
    </div>
  );
}
