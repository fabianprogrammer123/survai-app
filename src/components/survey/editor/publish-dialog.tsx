'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Globe,
  Loader2,
  Users,
  Sparkles,
  Link2,
  Mail,
  Mic,
  Check,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { cn } from '@/lib/utils';

const RESPONDENT_OPTIONS = [10, 25, 50, 100] as const;

export type PublishTab = 'publish' | 'distribute';

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: PublishTab;
}

export function PublishDialog({ open, onOpenChange, initialTab = 'publish' }: PublishDialogProps) {
  const [tab, setTab] = useState<PublishTab>(initialTab);
  const [count, setCount] = useState<number>(25);
  const [generateResponses, setGenerateResponses] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Sync tab when dialog re-opens with a different initialTab (e.g. Share vs Publish button).
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const title = useSurveyStore((s) => s.survey.title);
  const survey = useSurveyStore((s) => s.survey);
  const elements = useSurveyStore((s) => s.survey.elements);
  const isGenerating = useSurveyStore((s) => s.isGeneratingResponses);
  const isCreatingAgent = useSurveyStore((s) => s.isCreatingAgent);
  const publishConfig = useSurveyStore((s) => s.publishConfig);

  const setGeneratingResponses = useSurveyStore((s) => s.setGeneratingResponses);
  const setResponses = useSurveyStore((s) => s.setResponses);
  const setPublished = useSurveyStore((s) => s.setPublished);
  const setEditorMode = useSurveyStore((s) => s.setEditorMode);
  const setCreatingAgent = useSurveyStore((s) => s.setCreatingAgent);
  const setPublishConfig = useSurveyStore((s) => s.setPublishConfig);

  const answerableCount = elements.filter(
    (el) => !['section_header', 'page_break', 'file_upload'].includes(el.type)
  ).length;

  // Base64url-encode the current survey into a preview URL. This is the
  // shippable-today share link — works cross-device without a backend.
  // When Plan D lands, this will switch back to /s/{id} for persisted
  // publishes, and publishConfig.publicUrl will override when set.
  const surveyUrl = (() => {
    if (publishConfig.publicUrl) return publishConfig.publicUrl;
    if (typeof window === 'undefined') return '';
    try {
      const json = JSON.stringify(survey);
      const bytes = new TextEncoder().encode(json);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      return `${window.location.origin}/s/preview/${b64}`;
    } catch {
      return `${window.location.origin}/s/${survey.id || nanoid(10)}`;
    }
  })();

  // ── Create ElevenLabs Agent ──
  const createVoiceAgent = useCallback(async () => {
    if (publishConfig.agentId) return publishConfig.agentId;

    setCreatingAgent(true);
    setError(null);
    try {
      const res = await fetch('/api/elevenlabs/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ survey }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create voice agent');
      }

      const data = await res.json();
      setPublishConfig({
        agentId: data.agentId,
        publicUrl: surveyUrl,
      });
      return data.agentId as string;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create voice agent';
      setError(msg);
      return null;
    } finally {
      setCreatingAgent(false);
    }
  }, [survey, publishConfig.agentId, surveyUrl, setCreatingAgent, setPublishConfig]);

  // ── Publish (optionally with AI-generated responses) ──
  async function handlePublish() {
    setGeneratingResponses(true);
    setError(null);
    try {
      // Agent creation runs in parallel; response generation only if opted in.
      const [agentId] = await Promise.all([
        createVoiceAgent(),
        (async () => {
          if (!generateResponses) return;

          const res = await fetch('/api/ai/responses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ elements, count, title }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to generate responses');
          }

          const data = await res.json();
          setResponses(data.responses);
        })(),
      ]);

      // Persist publish state to DB (if survey has an ID from Supabase)
      if (survey.id) {
        try {
          await fetch(`/api/surveys/${survey.id}/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentId: agentId || undefined,
              publicUrl: surveyUrl,
            }),
          });
        } catch {
          // Non-critical: local state still updated even if DB persist fails
          console.warn('Failed to persist publish state to DB');
        }
      }

      setPublished(true);
      setPublishConfig({ publicUrl: surveyUrl });
      onOpenChange(false);

      // Only jump to Results view when there's data to look at.
      if (generateResponses) {
        setEditorMode('results');
      }

      const parts: string[] = [];
      parts.push(
        generateResponses
          ? `Survey published with ${count} AI-generated responses`
          : 'Survey published — share the link to start collecting responses'
      );
      if (agentId) parts.push('voice agent ready');
      const summary = parts.join(', ') + '.';
      const followUp = generateResponses
        ? ' Switched to Results view — ask me anything about your data.'
        : '';

      useSurveyStore.getState().addChatMessage({
        id: nanoid(),
        role: 'assistant',
        content: summary + followUp,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to publish';
      setError(msg);
    } finally {
      setGeneratingResponses(false);
    }
  }

  // ── Copy Link ──
  function handleCopyLink() {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tabs: { id: PublishTab; label: string; icon: React.ReactNode }[] = [
    { id: 'publish', label: 'Publish', icon: <Globe className="h-3.5 w-3.5" /> },
    { id: 'distribute', label: 'Share', icon: <Link2 className="h-3.5 w-3.5" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        Hard-override the dialog primitive's grid + default max-width:
        - `!max-w-lg` forces 32rem at every breakpoint (the primitive's
          responsive `sm:max-w-sm` and `calc(100%-2rem)` were making the
          dialog stretch to the viewport on wide screens).
        - `!grid-cols-1` neutralizes the default grid so our flex-col
          layout can own vertical distribution.
        - Outer is overflow-hidden; the tab-content wrapper scrolls
          internally so dialog height is always capped.
      */}
      <DialogContent
        className={cn(
          'w-[calc(100%-2rem)] !max-w-lg max-h-[85vh]',
          'flex flex-col overflow-hidden !grid-cols-1 gap-3'
        )}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Publish & Share
          </DialogTitle>
          <DialogDescription>
            Publish your survey and share the link with respondents.
          </DialogDescription>
        </DialogHeader>

        {/* Tab bar — fixed at top, never scrolls. */}
        <div className="flex gap-1 bg-muted/40 rounded-lg p-1 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(null); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                tab === t.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable body — single flex child that owns vertical overflow. */}
        <div className="flex-1 min-h-0 overflow-y-auto min-w-0">

        {/* ── Publish Tab ── */}
        {tab === 'publish' && (
          <div className="space-y-4 py-1 min-h-[360px]">
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="font-medium text-sm truncate">{title || 'Untitled Survey'}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {answerableCount} answerable question{answerableCount !== 1 ? 's' : ''}
              </div>
            </div>

            {/* AI-synthetic responses — opt-in, off by default */}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <label
                    htmlFor="generate-ai-responses"
                    className="text-sm font-medium text-foreground flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Generate AI-synthetic responses
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Seed the dashboard with simulated answers so you can preview analytics before real respondents arrive.
                  </p>
                </div>
                <Switch
                  id="generate-ai-responses"
                  checked={generateResponses}
                  onCheckedChange={setGenerateResponses}
                  disabled={isGenerating}
                />
              </div>

              {generateResponses && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                    <Users className="h-3 w-3" />
                    Respondents
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {RESPONDENT_OPTIONS.map((n) => (
                      <button
                        key={n}
                        onClick={() => setCount(n)}
                        disabled={isGenerating}
                        className={cn(
                          'rounded-lg border py-2 text-sm font-medium transition-all',
                          count === n
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground'
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Voice agent creation note */}
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
              <div className="flex items-start gap-2">
                <Mic className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Voice Agent Auto-Created</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    An ElevenLabs AI agent will be created so respondents can answer by voice on the survey link.
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handlePublish}
              disabled={isGenerating || isCreatingAgent || answerableCount === 0}
              className="w-full"
            >
              {isGenerating || isCreatingAgent ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  {isCreatingAgent
                    ? 'Creating voice agent...'
                    : generateResponses
                      ? `Generating ${count} responses...`
                      : 'Publishing...'}
                </>
              ) : generateResponses ? (
                <>
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Publish & Generate {count} Responses
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4 mr-1.5" />
                  Publish Survey
                </>
              )}
            </Button>
          </div>
        )}

        {/* ── Share Tab ── */}
        {tab === 'distribute' && (
          <div className="space-y-4 py-1 min-h-[360px]">
            {/* Survey Link */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Survey Link
              </label>
              {/* Compact link display + primary Copy button. Full URL is
                  kept in a hidden data attribute + input for programmatic
                  access (tests, QR code, etc.) while the visible chunk is
                  a short truncated string so multi-KB base64 preview URLs
                  no longer blow out the dialog. */}
              <div
                className="flex items-center gap-2"
                data-share-link-row="true"
              >
                <div
                  className="flex-1 min-w-0 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground truncate"
                  data-share-link-display="true"
                  title={surveyUrl}
                >
                  {(() => {
                    const m = surveyUrl.match(/^(https?:\/\/[^/]+\/s\/preview\/)(.+)$/);
                    if (m) {
                      const [, origin, b64] = m;
                      if (b64.length > 18) {
                        return `${origin}${b64.slice(0, 10)}...${b64.slice(-6)}`;
                      }
                    }
                    return surveyUrl;
                  })()}
                </div>
                <input
                  type="hidden"
                  readOnly
                  value={surveyUrl}
                  data-share-link-value="true"
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Link2 className="h-3.5 w-3.5 mr-1.5" />
                      Copy link
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Respondents can fill out the survey via web form or start a voice conversation.
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400" data-preview-link-note="true">
                Preview link: this is a shareable demo URL. Response collection requires a real backend (coming soon), so submissions won&apos;t appear in your dashboard yet.
              </p>
            </div>

            <Separator />

            {/* Distribution options: Copy Link + Email */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopyLink}
                className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-4 hover:bg-muted/40 transition-colors"
              >
                <Link2 className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">Copy Link</span>
              </button>
              <button
                onClick={() => {
                  const subject = encodeURIComponent(`Survey: ${title || 'Please take our survey'}`);
                  const body = encodeURIComponent(`Hi,\n\nPlease take a moment to complete our survey:\n${surveyUrl}\n\nThank you!`);
                  window.open(`mailto:?subject=${subject}&body=${body}`);
                }}
                className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-4 hover:bg-muted/40 transition-colors"
              >
                <Mail className="h-5 w-5 text-blue-400" />
                <span className="text-xs font-medium">Email</span>
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
