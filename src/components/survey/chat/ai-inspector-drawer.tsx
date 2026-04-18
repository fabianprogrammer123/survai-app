'use client';

import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useSurveyStore } from '@/lib/survey/store';
import { Copy, CheckCircle2, AlertCircle, Hash, Clock, Zap } from 'lucide-react';

export interface AiTraceRow {
  id: string;
  survey_id: string | null;
  turn_index: number;
  user_message: string | null;
  intent: string | null;
  model: string | null;
  system_prompt_hash: string | null;
  system_prompt_head: string | null;
  duration_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  proposals_count: number | null;
  commands: unknown;
  raw_response_sample: string | null;
  error: string | null;
  created_at: string;
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="h-7 gap-1 text-xs"
    >
      {copied ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      {label ?? (copied ? 'Copied' : 'Copy')}
    </Button>
  );
}

export function AiInspectorDrawer() {
  const inspectorTraceId = useSurveyStore((s) => s.inspectorTraceId);
  const setInspectorTraceId = useSurveyStore((s) => s.setInspectorTraceId);
  const [trace, setTrace] = useState<AiTraceRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inspectorTraceId) {
      setTrace(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/ai/trace/${inspectorTraceId}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Trace fetch failed (${res.status})`);
        }
        return res.json();
      })
      .then((body) => {
        if (cancelled) return;
        setTrace(body.trace as AiTraceRow);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load trace');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inspectorTraceId]);

  const open = inspectorTraceId !== null;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setInspectorTraceId(null);
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>AI Inspector</SheetTitle>
          <SheetDescription>
            Per-turn trace. See what the agent ran, how long it took, and how it
            replied.
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="mt-6 text-sm text-muted-foreground">
            Loading trace…
          </div>
        )}

        {error && (
          <div className="mt-6 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {trace && !loading && !error && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Stat
                icon={Clock}
                label="Duration"
                value={
                  trace.duration_ms !== null
                    ? `${(trace.duration_ms / 1000).toFixed(2)}s`
                    : '—'
                }
              />
              <Stat
                icon={Zap}
                label="Model"
                value={trace.model ?? 'unknown'}
              />
              <Stat
                icon={Hash}
                label="Intent"
                value={trace.intent ?? 'unknown'}
              />
              <Stat
                icon={Hash}
                label="Tokens"
                value={
                  trace.input_tokens !== null || trace.output_tokens !== null
                    ? `${trace.input_tokens ?? 0} in · ${trace.output_tokens ?? 0} out`
                    : '—'
                }
              />
            </div>

            {trace.proposals_count !== null && trace.proposals_count > 0 && (
              <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Proposals returned:</span>{' '}
                <span className="font-medium">{trace.proposals_count}</span>
              </div>
            )}

            {trace.error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <div className="font-medium mb-1">Error</div>
                <div className="font-mono text-xs break-all">{trace.error}</div>
              </div>
            )}

            {trace.user_message && (
              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    User message
                  </h3>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3 text-sm whitespace-pre-wrap break-words">
                  {trace.user_message}
                </div>
              </section>
            )}

            {trace.system_prompt_head && (
              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    System prompt (first 500 chars)
                    {trace.system_prompt_hash && (
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground/70">
                        #{trace.system_prompt_hash}
                      </span>
                    )}
                  </h3>
                  <CopyButton text={trace.system_prompt_head} />
                </div>
                <pre className="rounded-lg border bg-muted/20 p-3 text-[11px] font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                  {trace.system_prompt_head}
                </pre>
              </section>
            )}

            {trace.raw_response_sample && (
              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Raw response (first 2k chars)
                  </h3>
                  <CopyButton text={trace.raw_response_sample} />
                </div>
                <pre className="rounded-lg border bg-muted/20 p-3 text-[11px] font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                  {trace.raw_response_sample}
                </pre>
              </section>
            )}

            {Array.isArray(trace.commands) && trace.commands.length > 0 ? (
              <section>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Commands
                </h3>
                <pre className="rounded-lg border bg-muted/20 p-3 text-[11px] font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                  {JSON.stringify(trace.commands, null, 2)}
                </pre>
              </section>
            ) : null}

            <div className="text-[10px] text-muted-foreground/70">
              Trace id: {trace.id}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
