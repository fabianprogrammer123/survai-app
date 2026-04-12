'use client';

import { useEffect, useState } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { EditorCanvas } from '@/components/survey/editor/editor-canvas';
import { BlockPalette } from '@/components/survey/editor/block-palette';
import { RightPanel } from '@/components/survey/editor/right-panel';
import { EditorHeader } from '@/components/survey/editor/editor-header';
import { DEFAULT_SETTINGS } from '@/types/survey';
import { AlertTriangle } from 'lucide-react';

const TEST_SURVEY = {
  id: 'test-local',
  title: 'Untitled Survey',
  description: '',
  elements: [],
  settings: DEFAULT_SETTINGS,
  published: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default function AdminPage() {
  const setSurvey = useSurveyStore((s) => s.setSurvey);
  const title = useSurveyStore((s) => s.survey.title);
  const elementCount = useSurveyStore((s) => s.survey.elements.length);
  const isChatLoading = useSurveyStore((s) => s.isChatLoading);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  useEffect(() => {
    setSurvey(TEST_SURVEY);
    fetch('/api/ai/health')
      .then((r) => r.json())
      .then((data) => setApiKeyMissing(!data.openaiConfigured))
      .catch(() => {});
  }, [setSurvey]);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* API key warning */}
      {apiKeyMissing && (
        <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-4 py-2 text-sm border-b shrink-0">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>OPENAI_API_KEY</strong> not found in{' '}
            <code className="bg-destructive/10 px-1 rounded">.env.local</code>.
            Add it and restart the dev server to use AI features.
          </span>
        </div>
      )}

      {/* Header with Edit/Preview toggle and Publish/Share */}
      <EditorHeader
        leftContent={
          <>
            <h1 className="text-lg font-semibold truncate">
              {title || 'Untitled Survey'}
            </h1>
            <span className="text-sm text-muted-foreground">
              {elementCount} element{elementCount !== 1 ? 's' : ''}
            </span>
            {isChatLoading && (
              <span className="text-sm text-primary animate-pulse">Generating...</span>
            )}
          </>
        }
      />

      {/* 3-panel layout: Palette | Canvas | RightPanel (Chat+Properties) */}
      <div className="flex flex-1 overflow-hidden">
        <BlockPalette className="w-[200px] border-r shrink-0 bg-background" />
        <EditorCanvas className="flex-1 min-w-0" />
        <RightPanel
          className="w-[400px] border-l shrink-0 bg-background"
          aiEndpoint="/api/ai/chat/test"
        />
      </div>
    </div>
  );
}
