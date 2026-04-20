'use client';

import { Suspense } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSurveyStore } from '@/lib/survey/store';
import { EditorCanvas } from '@/components/survey/editor/editor-canvas';
import { RightPanel } from '@/components/survey/editor/right-panel';
import { EditorHeader } from '@/components/survey/editor/editor-header';
import { Button } from '@/components/ui/button';
import { DEFAULT_SETTINGS, type Survey } from '@/types/survey';
import {
  getSurvey,
  saveSurvey,
  createSurveyFromTemplate,
} from '@/lib/survey/local-surveys';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Loader2 as SaveSpinner,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { AxiomMark } from '@/components/axiom-mark';
import { useColorMode } from '@/hooks/use-color-mode';
import { cn } from '@/lib/utils';

function EditorContent() {
  // Sync color mode with <html> class (dark/light)
  useColorMode();
  const router = useRouter();
  const searchParams = useSearchParams();
  const surveyId = searchParams.get('id');

  const setSurvey = useSurveyStore((s) => s.setSurvey);
  const elementCount = useSurveyStore((s) => s.survey.elements.length);
  const surveyTitle = useSurveyStore((s) => s.survey.title);
  const isChatLoading = useSurveyStore((s) => s.isChatLoading);
  const isDirty = useSurveyStore((s) => s.isDirty);
  const markClean = useSurveyStore((s) => s.markClean);

  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [notFound, setNotFound] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('survai-panel-open');
    return saved !== null ? saved === 'true' : true;
  });

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load survey on mount. No id in the URL = the visitor hit
  // /test/edit directly (e.g. from the landing "Start Building"
  // CTA), so mint a fresh blank draft and replace the URL so refresh
  // / back don't mint a second one. A present-but-missing id still
  // shows "Survey not found" — that path is reached by deep links to
  // a draft the user has since deleted, where silent re-creation
  // would be surprising.
  useEffect(() => {
    if (!surveyId) {
      const fresh = createSurveyFromTemplate('blank');
      router.replace(`/test/edit?id=${fresh.id}`);
      return;
    }

    const survey = getSurvey(surveyId);
    if (!survey) {
      setNotFound(true);
      return;
    }

    setSurvey(survey);

    fetch('/api/ai/health')
      .then((r) => r.json())
      .then((data) => setApiKeyMissing(!data.openaiConfigured))
      .catch(() => {});
  }, [surveyId, setSurvey, router]);

  // Auto-save to localStorage (debounced 1s)
  useEffect(() => {
    if (!isDirty || !surveyId) return;
    setSaveState('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const survey = useSurveyStore.getState().survey;
      try {
        saveSurvey(survey);
        markClean();
        setSaveState('saved');
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSaveState('idle'), 3000);
      } catch (e) {
        console.error('Auto-save failed:', e);
        setSaveState('idle');
      }
    }, 1000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [isDirty, markClean, surveyId]);

  function togglePanel() {
    setPanelOpen((v) => {
      const next = !v;
      localStorage.setItem('survai-panel-open', String(next));
      return next;
    });
  }

  if (notFound) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg font-medium text-foreground mb-2">Survey not found</p>
          <p className="text-sm text-muted-foreground mb-6">This survey may have been deleted.</p>
          <Button onClick={() => router.push('/test')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

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

      {/* Header */}
      <EditorHeader
        leftContent={
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => router.push('/test')}
              title="Back to dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <AxiomMark size="md" />
            <span className="mx-1 h-5 w-px bg-border/60" />
            <span className="text-sm text-muted-foreground truncate max-w-[200px]">
              {surveyTitle || 'Untitled Survey'}
            </span>
            <span className="mx-1 text-muted-foreground/30">·</span>
            <span className="text-xs text-muted-foreground/60">
              {elementCount} element{elementCount !== 1 ? 's' : ''}
            </span>
            {isChatLoading && (
              <span className="text-sm text-primary animate-pulse">Generating...</span>
            )}
            <span className="flex items-center gap-1 text-xs text-muted-foreground/70 min-w-[60px]">
              {saveState === 'saving' && (
                <>
                  <SaveSpinner className="h-3 w-3 animate-spin" />
                  Saving
                </>
              )}
              {saveState === 'saved' && (
                <>
                  <Check className="h-3 w-3 text-green-400" />
                  Saved
                </>
              )}
            </span>
          </>
        }
        rightContent={
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={togglePanel}
            title={panelOpen ? 'Hide panel' : 'Show AI & properties'}
          >
            {panelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
        }
      />

      {/* 2-panel layout. On md+ the right-panel sits beside the canvas; below
          md it becomes a fixed bottom-drawer with a tap-dismiss backdrop, and
          a floating toggle button appears when the drawer is closed. Only one
          <RightPanel> is rendered — its classes switch between desktop and
          mobile layouts via Tailwind responsive utilities. */}
      <div className="relative flex flex-1 overflow-hidden">
        <EditorCanvas className="flex-1 min-w-0" />

        {/* Mobile backdrop (only visible when panel is open and below md) */}
        {panelOpen && (
          <button
            type="button"
            aria-label="Close AI panel"
            onClick={togglePanel}
            className="md:hidden fixed inset-0 z-40 bg-black/25"
          />
        )}

        {panelOpen && (
          <RightPanel
            className={cn(
              // Desktop: side panel
              'md:static md:flex md:w-[440px] md:border-l md:shrink-0 md:bg-background md:inset-auto md:h-auto md:rounded-none md:shadow-none',
              // Mobile: fixed bottom drawer
              'fixed inset-x-0 bottom-0 z-50 h-[55vh] w-full border-t border-border rounded-t-2xl bg-background shadow-2xl'
            )}
            aiEndpoint="/api/ai/chat/test"
            aiStreamEndpoint="/api/ai/chat/test/stream"
          />
        )}

        {/* Mobile-only floating toggle button when panel is closed */}
        {!panelOpen && (
          <button
            type="button"
            onClick={togglePanel}
            aria-label="Open AI chat and properties"
            className="md:hidden fixed bottom-4 right-4 z-30 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          >
            <PanelRightOpen className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function EditPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background">
        <SaveSpinner className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
}
