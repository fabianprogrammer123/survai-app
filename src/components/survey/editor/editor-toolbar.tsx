'use client';

import { useSurveyStore } from '@/lib/survey/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Eye, Globe, Loader2 } from 'lucide-react';
import Link from 'next/link';

export function EditorToolbar() {
  const title = useSurveyStore((s) => s.survey.title);
  const isDirty = useSurveyStore((s) => s.isDirty);
  const published = useSurveyStore((s) => s.survey.published);

  return (
    <div className="flex items-center gap-4 border-b px-4 py-2 bg-background shrink-0">
      <Link href="/dashboard">
        <Button variant="ghost" size="icon">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </Link>

      <h1 className="text-lg font-semibold truncate">{title || 'Untitled Survey'}</h1>

      {isDirty && (
        <Badge variant="secondary" className="shrink-0">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Saving
        </Badge>
      )}

      {published && (
        <Badge variant="default" className="shrink-0">Published</Badge>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm">
          <Eye className="mr-2 h-4 w-4" /> Preview
        </Button>
        <Button size="sm">
          <Globe className="mr-2 h-4 w-4" /> Publish
        </Button>
      </div>
    </div>
  );
}
