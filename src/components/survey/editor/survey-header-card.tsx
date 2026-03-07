'use client';

import { useSurveyStore } from '@/lib/survey/store';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export function SurveyHeaderCard() {
  const title = useSurveyStore((s) => s.survey.title);
  const description = useSurveyStore((s) => s.survey.description);
  const setTitle = useSurveyStore((s) => s.setTitle);
  const setDescription = useSurveyStore((s) => s.setDescription);

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm border-t-4 border-t-primary">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="border-none text-2xl font-bold p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
        placeholder="Untitled Survey"
      />
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="border-none text-muted-foreground p-0 mt-2 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[40px]"
        placeholder="Survey description (optional)"
        rows={2}
      />
    </div>
  );
}
