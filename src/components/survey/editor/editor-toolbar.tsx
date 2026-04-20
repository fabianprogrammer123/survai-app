'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSurveyStore } from '@/lib/survey/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Eye, Edit2, Globe, Loader2, BarChart3 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { PublishDialog } from './publish-dialog';
import Link from 'next/link';

export function EditorToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const title = useSurveyStore((s) => s.survey.title);
  const isDirty = useSurveyStore((s) => s.isDirty);
  const isPublished = useSurveyStore((s) => s.isPublished);
  const editorMode = useSurveyStore((s) => s.editorMode);
  const setEditorMode = useSurveyStore((s) => s.setEditorMode);
  const [publishOpen, setPublishOpen] = useState(false);

  // /claim-draft hands off publish intent via query params. Read them
  // once on mount, open the Publish dialog with the same options the
  // user picked pre-login, and strip the params so a refresh doesn't
  // re-fire publish.
  const claimHandoffRef = useRef<{
    autoFire: boolean;
    count: number;
    generateResponses: boolean;
  } | null>(null);

  if (claimHandoffRef.current === null && searchParams.get('autopublish') === '1') {
    claimHandoffRef.current = {
      autoFire: true,
      count: Number(searchParams.get('count')) || 25,
      generateResponses: searchParams.get('gen') === '1',
    };
  }

  useEffect(() => {
    if (!claimHandoffRef.current?.autoFire) return;
    setPublishOpen(true);
    // Strip the autopublish params so a refresh doesn't reopen the
    // dialog and fire a second publish.
    const next = new URLSearchParams(searchParams.toString());
    next.delete('autopublish');
    next.delete('count');
    next.delete('gen');
    const suffix = next.toString();
    router.replace(window.location.pathname + (suffix ? `?${suffix}` : ''));
    // One-shot; no deps needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        autoFire={claimHandoffRef.current?.autoFire ?? false}
        initialCount={claimHandoffRef.current?.count}
        initialGenerateResponses={claimHandoffRef.current?.generateResponses}
      />
    </>
  );
}
