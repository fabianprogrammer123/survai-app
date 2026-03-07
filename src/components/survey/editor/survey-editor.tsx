'use client';

import { useEffect } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { ChatPanel } from '@/components/survey/chat/chat-panel';
import { EditorCanvas } from '@/components/survey/editor/editor-canvas';
import { PropertiesPanel } from '@/components/survey/editor/properties-panel';
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

  useAutoSave();

  return (
    <div className="flex h-screen flex-col bg-background">
      <EditorToolbar />
      <div className="flex flex-1 overflow-hidden">
        <ChatPanel className="w-[320px] border-r shrink-0" />
        <EditorCanvas className="flex-1 min-w-0" />
        <PropertiesPanel className="w-[320px] border-l shrink-0" />
      </div>
    </div>
  );
}
