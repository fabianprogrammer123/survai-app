'use client';

import { useState } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Eye, Edit2, Globe, Loader2, BarChart3 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { PublishDialog } from './publish-dialog';
import Link from 'next/link';

export function EditorToolbar() {
  const surveyId = useSurveyStore((s) => s.survey.id);
  const title = useSurveyStore((s) => s.survey.title);
  const isDirty = useSurveyStore((s) => s.isDirty);
  const isPublished = useSurveyStore((s) => s.isPublished);
  const editorMode = useSurveyStore((s) => s.editorMode);
  const setEditorMode = useSurveyStore((s) => s.setEditorMode);
  const [publishOpen, setPublishOpen] = useState(false);

  const isPreview = editorMode === 'preview';

  return (
    <>
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

        {isPublished && (
          <span className="shrink-0 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400 border border-green-500/20">
            Published
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isPublished && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditorMode('results');
                useSurveyStore.getState().addChatMessage({
                  id: nanoid(),
                  role: 'assistant',
                  content: 'Switched to Results view. You can ask me to analyze specific aspects of your survey data.',
                  timestamp: new Date().toISOString(),
                });
              }}
            >
              <BarChart3 className="mr-2 h-4 w-4" /> Results
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditorMode(isPreview ? 'editor' : 'preview')}
          >
            {isPreview ? (
              <><Edit2 className="mr-2 h-4 w-4" /> Edit</>
            ) : (
              <><Eye className="mr-2 h-4 w-4" /> Preview</>
            )}
          </Button>
          <Button size="sm" onClick={() => setPublishOpen(true)}>
            <Globe className="mr-2 h-4 w-4" /> {isPublished ? 'Re-publish' : 'Publish'}
          </Button>
        </div>
      </div>

      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} />
    </>
  );
}
