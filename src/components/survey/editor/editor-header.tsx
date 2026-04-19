'use client';

import { useState } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { Button } from '@/components/ui/button';
import { Share2, Globe, BarChart3, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PublishDialog, type PublishTab } from './publish-dialog';

interface EditorHeaderProps {
  /** Extra content to render on the left (e.g. title, element count). */
  leftContent?: React.ReactNode;
  /** Extra content to render before the right buttons (e.g. panel toggle). */
  rightContent?: React.ReactNode;
  className?: string;
}

export function EditorHeader({ leftContent, rightContent, className }: EditorHeaderProps) {
  const editorMode = useSurveyStore((s) => s.editorMode);
  const setEditorMode = useSurveyStore((s) => s.setEditorMode);
  const isPublished = useSurveyStore((s) => s.isPublished);
  const publicUrl = useSurveyStore((s) => s.publishConfig.publicUrl);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishTab, setPublishTab] = useState<PublishTab>('publish');

  return (
    <>
      <div
        className={cn(
          'flex items-center border-b border-border/60 px-2 sm:px-5 py-2.5 bg-background shrink-0 gap-2',
          className
        )}
      >
        {/* Left section */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {leftContent}
          {isPublished && (
            publicUrl ? (
              // Clickable Live chip — opens the live survey in a new tab so
              // creators get immediate "yes, it's really live" feedback.
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open live survey: ${publicUrl}`}
                data-live-badge="true"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-green-500/15 hover:bg-green-500/25 px-2.5 py-1 text-xs font-semibold text-green-500 dark:text-green-400 border border-green-500/30 transition-colors"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                Live
                <ExternalLink className="h-3 w-3 opacity-70" />
              </a>
            ) : (
              <span
                data-live-badge="true"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-500 dark:text-green-400 border border-green-500/30"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                Live
              </span>
            )
          )}
        </div>

        {/* Center: Edit / Preview / Results toggle */}
        <div className="hidden md:flex items-center bg-muted/80 rounded-xl p-1 gap-0.5">
          <button
            onClick={() => setEditorMode('editor')}
            className={cn(
              'px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200',
              editorMode === 'editor'
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
          >
            Edit
          </button>
          <button
            onClick={() => setEditorMode('preview')}
            className={cn(
              'px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200',
              editorMode === 'preview'
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
          >
            Preview
          </button>
          {isPublished && (
            <button
              onClick={() => setEditorMode('results')}
              className={cn(
                'px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-1.5',
                editorMode === 'results'
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Results
            </button>
          )}
        </div>

        {/* Right: Publish / Share buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 md:flex-1 justify-end shrink-0">
          {rightContent}
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex h-9 px-4 rounded-lg border-border/60"
            onClick={() => {
              setPublishTab('distribute');
              setPublishOpen(true);
            }}
          >
            <Share2 className="h-3.5 w-3.5 mr-2" />
            Share
          </Button>
          <Button
            size="sm"
            className="h-9 px-3 sm:px-4 rounded-lg shadow-sm"
            onClick={() => {
              setPublishTab('publish');
              setPublishOpen(true);
            }}
          >
            <Globe className="h-3.5 w-3.5 sm:mr-2" />
            <span className="hidden sm:inline">{isPublished ? 'Re-publish' : 'Publish'}</span>
          </Button>
        </div>
      </div>

      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} initialTab={publishTab} />
    </>
  );
}
