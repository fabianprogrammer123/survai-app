'use client';

import { FileText } from 'lucide-react';
import { SurveyCard } from './survey-card';
import type { SurveyMeta } from '@/lib/survey/local-surveys';

interface SurveyGridProps {
  surveys: SurveyMeta[];
  searchQuery: string;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SurveyGrid({ surveys, searchQuery, onDuplicate, onDelete }: SurveyGridProps) {
  const filtered = searchQuery
    ? surveys.filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : surveys;

  return (
    <section>
      {filtered.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-muted-foreground">Recent forms</h2>
        </div>
      )}

      {filtered.length === 0 && surveys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
            <FileText className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-foreground/60 mb-1">No surveys yet</p>
          <p className="text-xs text-muted-foreground/60">Create your first survey using a template above</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">No surveys match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((survey) => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}
