'use client';

import { Component, useEffect, useRef, useCallback, useState, type ReactNode } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { A2UIProvider, A2UIRenderer } from '@a2ui-sdk/react/0.8';
import { surveyCatalog } from '@/lib/a2ui/catalog';
import { buildInitialDashboard } from '@/lib/ai/chart-mapper';
import { nanoid } from 'nanoid';
import { Loader2, BarChart3, AlertTriangle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Error boundary to catch A2UI rendering failures gracefully.
 */
class DashboardErrorBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-destructive font-medium">Failed to render dashboard</p>
          <p className="text-xs text-muted-foreground mt-1">{this.state.error.message}</p>
          <button
            onClick={() => {
              this.setState({ error: null });
              this.props.onRetry();
            }}
            className="mt-3 px-4 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Retry Analysis
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface ResultsPanelProps {
  className?: string;
  aiEndpoint?: string;
}

/**
 * Build and download a CSV from the survey responses.
 */
function downloadCSV() {
  const store = useSurveyStore.getState();
  const { elements, responses } = { elements: store.survey.elements, responses: store.responses };

  if (responses.length === 0) return;

  // Collect all answerable elements as columns
  const columns = elements.filter((el) => !['section_header', 'page_break'].includes(el.type));
  const headers = ['Response ID', 'Submitted At', ...columns.map((c) => c.title || c.id)];

  const rows = responses.map((r) => {
    const cells: string[] = [
      r.id,
      r.submittedAt,
      ...columns.map((col) => {
        const val = r.answers[col.id];
        if (val === undefined || val === null) return '';
        if (Array.isArray(val)) return val.join('; ');
        return String(val);
      }),
    ];
    return cells;
  });

  // Escape CSV values
  const escape = (v: string) => {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${store.survey.title || 'survey'}-responses.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Convert flat component definitions into A2UI message format.
 */
function convertComponentsToA2UI(
  components: Array<{
    id: string;
    componentType: string;
    props: Record<string, unknown>;
    children?: string[];
  }>
) {
  const root = components.find((c) => c.id === 'root') || components[0];
  if (!root) return [];

  const a2uiComponents = components.map((c) => {
    const componentProps: Record<string, unknown> = { ...c.props };
    if (c.children && c.children.length > 0) {
      componentProps.children = { explicitList: c.children };
    }
    return {
      id: c.id,
      component: { [c.componentType]: componentProps },
    };
  });

  return [
    { beginRendering: { surfaceId: 'results-dashboard', root: root.id } },
    { surfaceUpdate: { surfaceId: 'results-dashboard', components: a2uiComponents } },
  ];
}

export function ResultsPanel({ className, aiEndpoint = '/api/ai/results' }: ResultsPanelProps) {
  const responses = useSurveyStore((s) => s.responses);
  const a2uiMessages = useSurveyStore((s) => s.a2uiMessages);
  const isLoading = useSurveyStore((s) => s.isResultsChatLoading);
  const hasInitialized = useRef(false);
  const [dashboardReady, setDashboardReady] = useState(false);

  // Generate the initial dashboard deterministically from question types,
  // then optionally refine via AI on follow-up questions.
  const initDashboard = useCallback(
    () => {
      const store = useSurveyStore.getState();
      setDashboardReady(false);

      try {
        // Deterministic chart mapping — instant, no API call
        const { components, message } = buildInitialDashboard(
          store.survey.elements,
          store.responses
        );

        // Convert to A2UI messages
        const a2uiMessages = convertComponentsToA2UI(components);

        // Add summary to main chat
        store.addChatMessage({
          id: `msg_${nanoid(8)}`,
          role: 'assistant',
          content: message,
          timestamp: new Date().toISOString(),
        });

        store.addResultsChatMessage({
          id: `msg_${nanoid(8)}`,
          role: 'assistant',
          content: message,
          timestamp: new Date().toISOString(),
        });

        store.setA2UIMessages(a2uiMessages);
        requestAnimationFrame(() => setDashboardReady(true));
      } catch (error) {
        console.error('Chart mapper error:', error);
        useSurveyStore.getState().addChatMessage({
          id: `msg_${nanoid(8)}`,
          role: 'assistant',
          content: 'Sorry, I encountered an error generating the dashboard. Please try again.',
          timestamp: new Date().toISOString(),
        });
      }
    },
    []
  );

  // Auto-generate initial dashboard on mount
  useEffect(() => {
    if (!hasInitialized.current && responses.length > 0 && a2uiMessages.length === 0) {
      hasInitialized.current = true;
      initDashboard();
    }
  }, [responses.length, a2uiMessages.length, initDashboard]);

  // Mark dashboard ready when a2ui messages arrive from follow-up queries
  useEffect(() => {
    if (a2uiMessages.length > 0 && !dashboardReady) {
      requestAnimationFrame(() => setDashboardReady(true));
    }
  }, [a2uiMessages.length, dashboardReady]);

  const handleAction = useCallback(() => {
    // Handle A2UI actions (button clicks, etc.) if needed
  }, []);

  return (
    <div className={cn('overflow-y-auto p-6', className)}>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Summary header */}
        <div className="flex items-end justify-between pb-2 border-b border-border/60">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Survey Results
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {responses.length} response{responses.length !== 1 ? 's' : ''} collected
            </p>
          </div>
          {responses.length > 0 && (
            <button
              onClick={downloadCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          )}
        </div>

        {/* Empty state */}
        {!isLoading && responses.length === 0 && a2uiMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <BarChart3 className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No responses yet</p>
            <p className="text-xs mt-1">Publish your survey to generate mock responses</p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && a2uiMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm">Analyzing responses...</p>
          </div>
        )}

        {/* A2UI rendered dashboard with stream-in animation */}
        {a2uiMessages.length > 0 && (
          <DashboardErrorBoundary onRetry={() => initDashboard()}>
            <div className={cn(
              'a2ui-dashboard space-y-4 transition-all duration-700',
              dashboardReady
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-6'
            )}>
              <A2UIProvider
                messages={a2uiMessages}
                catalog={surveyCatalog}
              >
                <A2UIRenderer onAction={handleAction} />
              </A2UIProvider>
            </div>
          </DashboardErrorBoundary>
        )}

        {/* Loading overlay when updating */}
        {isLoading && a2uiMessages.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-primary mt-4 animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin" />
            Updating analysis...
          </div>
        )}
      </div>
    </div>
  );
}
