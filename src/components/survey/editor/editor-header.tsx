'use client';

import { useState } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { Button } from '@/components/ui/button';
import { Share2, Globe, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PublishDialog } from './publish-dialog';

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
  const [publishOpen, setPublishOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          'flex items-center border-b border-border/60 px-5 py-2.5 bg-background shrink-0',
          className
        )}
      >
        {/* Left section */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {leftContent}
          {isPublished && (
            <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400 border border-green-500/15">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </span>
          )}
        </div>

        {/* Center: Edit / Preview / Results toggle */}
        <div className="flex items-center bg-muted/80 rounded-xl p-1 gap-0.5">
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
        <div className="flex items-center gap-2.5 flex-1 justify-end">
          {rightContent}
          <Button variant="outline" size="sm" className="h-9 px-4 rounded-lg border-border/60">
            <Share2 className="h-3.5 w-3.5 mr-2" />
            Share
          </Button>
          <Button
            size="sm"
            className="h-9 px-4 rounded-lg shadow-sm"
            onClick={() => setPublishOpen(true)}
          >
            <Globe className="h-3.5 w-3.5 mr-2" />
            {isPublished ? 'Re-publish' : 'Publish'}
          </Button>
        </div>
      </div>

      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} />
    </>
  );
}
