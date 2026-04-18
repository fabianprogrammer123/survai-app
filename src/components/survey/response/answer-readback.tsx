'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ElementRenderer } from '@/components/survey/elements/element-renderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import type { SurveyElement } from '@/types/survey';

interface SurveyData {
  id: string;
  title: string;
  description: string;
  schema: SurveyElement[];
  settings: Record<string, unknown>;
}

interface AnswerReadbackProps {
  survey: SurveyData;
  conversationId: string;
  // Persist to the same /api/surveys/:id/submit endpoint; the guest token
  // (if present) threads through so the guests row gets linked.
  guestToken?: string;
  // Called once the submit round-trip succeeds.
  onSubmitted: () => void;
  // Called if the respondent chooses to go back / start over.
  onCancel?: () => void;
}

type Stage =
  | 'polling' // waiting for the webhook to land the extracted answers
  | 'polling_slow' // still polling, past the "soft" deadline — user can choose to keep waiting or bail
  | 'editing' // webhook returned answers; user is reviewing / editing
  | 'submitting' // POST in flight
  | 'error'; // final submit failed

// Polling cadence: ElevenLabs post-call webhooks usually land within 3–8s.
// We start polling immediately, first poll after a short delay to let the
// webhook arrive for fast calls, then every 2s. After 15s we surface a
// "taking longer than usual" notice (still polling). Hard cap at 60s to
// avoid indefinite loops.
const INITIAL_DELAY_MS = 1500;
const POLL_INTERVAL_MS = 2000;
const SLOW_THRESHOLD_MS = 15_000;
const HARD_TIMEOUT_MS = 60_000;

/**
 * Review-and-submit screen that appears after a voice conversation ends.
 * Polls the ElevenLabs webhook GET route to pick up the answers extracted
 * during the call, then renders them as editable inputs for the
 * respondent to review before committing.
 */
export function AnswerReadback({
  survey,
  conversationId,
  guestToken,
  onSubmitted,
  onCancel,
}: AnswerReadbackProps) {
  const [stage, setStage] = useState<Stage>('polling');
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Questions the respondent will actually see (skip layout-only elements).
  const questions = useMemo(
    () =>
      (survey.schema || []).filter(
        (el) => !['section_header', 'page_break'].includes(el.type)
      ),
    [survey.schema]
  );

  // ── Polling loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'polling' && stage !== 'polling_slow') return;

    const startedAt = Date.now();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      try {
        const res = await fetch(
          `/api/webhooks/elevenlabs?conversationId=${encodeURIComponent(
            conversationId
          )}`,
          { cache: 'no-store' }
        );
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as {
            response?: { answers?: Record<string, unknown> } | null;
          };
          const incoming = body.response?.answers;
          if (incoming && Object.keys(incoming).length > 0) {
            if (!mountedRef.current) return;
            setAnswers(incoming);
            setStage('editing');
            return;
          }
        }
      } catch {
        // Network hiccup — ignore and retry on the next tick.
      }

      if (elapsed > HARD_TIMEOUT_MS) {
        if (!mountedRef.current) return;
        // Promote to editing with empty answers so the respondent can
        // still type their answers manually rather than losing the call.
        setAnswers({});
        setStage('editing');
        return;
      }
      if (elapsed > SLOW_THRESHOLD_MS && mountedRef.current) {
        setStage((s) => (s === 'polling' ? 'polling_slow' : s));
      }
      timeoutId = setTimeout(tick, POLL_INTERVAL_MS);
    };

    timeoutId = setTimeout(tick, INITIAL_DELAY_MS);
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [stage, conversationId]);

  const handleChange = useCallback((elementId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [elementId]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    setStage('submitting');
    setSubmitError(null);
    try {
      const res = await fetch(`/api/surveys/${survey.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          guestToken,
          channel: 'web_voice',
          conversationId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Submit failed (${res.status})`);
      }
      if (!mountedRef.current) return;
      onSubmitted();
    } catch (err) {
      if (!mountedRef.current) return;
      setSubmitError(err instanceof Error ? err.message : 'Submit failed');
      setStage('error');
    }
  }, [answers, conversationId, guestToken, onSubmitted, survey.id]);

  // ── Render states ─────────────────────────────────────────────────────

  if (stage === 'polling' || stage === 'polling_slow') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">
            {stage === 'polling_slow'
              ? 'Almost there…'
              : 'Saving your answers…'}
          </p>
          <p className="text-sm text-muted-foreground">
            {stage === 'polling_slow'
              ? 'This is taking a little longer than usual. Hang tight, or review your answers manually.'
              : 'Just a sec while we pull together what you said.'}
          </p>
          {stage === 'polling_slow' && (
            <div className="mt-6 flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAnswers({});
                  setStage('editing');
                }}
                className="min-h-11"
              >
                Review manually
              </Button>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Start over
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-6 sm:py-8 px-3 sm:px-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 text-center">
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
            Quick review
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here&apos;s what we heard. Edit anything that looks off, then submit.
          </p>
        </div>

        <div className="space-y-4" data-answer-readback="true">
          {questions.map((element) => (
            <Card key={element.id}>
              <CardContent className="pt-6 px-4 sm:px-6">
                <ElementRenderer
                  element={element}
                  mode="response"
                  value={answers[element.id]}
                  onChange={(value) => handleChange(element.id, value)}
                />
              </CardContent>
            </Card>
          ))}
        </div>

        {submitError && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3 justify-between">
          {onCancel ? (
            <button
              onClick={onCancel}
              className="min-h-11 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back
            </button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={stage === 'submitting'}
            className="min-h-11 px-6"
            data-answer-readback-submit="true"
          >
            {stage === 'submitting' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
