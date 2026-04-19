'use client';

import { useEffect } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { EditorCanvas } from '@/components/survey/editor/editor-canvas';
import { BlockPalette } from '@/components/survey/editor/block-palette';
import { RightPanel } from '@/components/survey/editor/right-panel';
import { EditorToolbar } from '@/components/survey/editor/editor-toolbar';
import { useAutoSave } from '@/hooks/use-auto-save';
import { Survey } from '@/types/survey';

interface SurveyEditorProps {
  initialSurvey: Survey;
}

export function SurveyEditor({ initialSurvey }: SurveyEditorProps) {
  const setSurvey = useSurveyStore((s) => s.setSurvey);

  useEffect(() => {
    setSurvey(initialSurvey);
  }, [initialSurvey, setSurvey]);

  const { saveError } = useAutoSave();

  return (
    <div className="flex h-screen flex-col bg-background">
      <EditorToolbar />
      {saveError && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-sm text-destructive flex items-center gap-2">
          <span className="font-medium">Auto-save failed:</span> {saveError}
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <BlockPalette className="w-[200px] border-r shrink-0 bg-background" />
        <EditorCanvas className="flex-1 min-w-0" />
        <RightPanel
          className="w-[400px] border-l shrink-0 bg-background"
          aiEndpoint="/api/ai/chat"
        />
      </div>
    </div>
  );
}
