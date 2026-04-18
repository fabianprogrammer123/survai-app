'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useConversation } from '@elevenlabs/react';
import { Mic, Volume2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type VoiceTurn = { role: 'agent' | 'user'; text: string };

export type VoiceEndReason =
  | 'user_ended'
  | 'agent_disconnected'
  | 'mic_denied'
  | 'connect_failed'
  | 'runtime_error';

export interface VoiceEndResult {
  conversationId: string | null;
  transcript: VoiceTurn[];
  reason: VoiceEndReason;
  error?: string;
}

interface VoiceSessionProps {
  agentId: string;
  // Optional ElevenLabs dynamic variables (e.g. `guest_name`). Passed through
  // to `startSession` verbatim.
  dynamicVariables?: Record<string, string>;
  // Total questions in this survey — used for a light progress chip. The
  // agent itself doesn't emit per-question events, so we derive a rough
  // "Question N / total" signal from the count of completed user turns.
  // This is intentionally approximate; undercounting is preferred over
  // overclaiming progress.
  totalQuestions?: number;
  onEnded: (result: VoiceEndResult) => void;
  onSwitchToText: () => void;
}

/**
 * Self-contained voice-interview surface. Mounts → auto-starts the
 * ElevenLabs session (the parent already consumed the required user
 * gesture when the respondent tapped the "Answer by voice" CTA).
 *
 * Calls `onEnded` exactly once with a terminal reason so the parent can
 * transition to the read-back / error screen.
 */
export function VoiceSession({
  agentId,
  dynamicVariables,
  totalQuestions,
  onEnded,
  onSwitchToText,
}: VoiceSessionProps) {
  const [status, setStatus] = useState<
    'connecting' | 'active' | 'ended' | 'error'
  >('connecting');
  const [transcript, setTranscript] = useState<VoiceTurn[]>([]);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoplayPrompt, setAutoplayPrompt] = useState(false);

  const conversationIdRef = useRef<string | null>(null);
  const transcriptRef = useRef<VoiceTurn[]>([]);
  // `onEnded` must fire exactly once. Multiple SDK callbacks (onDisconnect
  // + onError + component unmount) can race; this ref guarantees dedup.
  const endedRef = useRef(false);
  // Keep the latest callback refs so the SDK closures don't capture stale
  // props. Stable reference → SDK handlers don't need to be in effect deps.
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const emitEnd = useCallback((result: VoiceEndResult) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setStatus(result.reason === 'user_ended' ? 'ended' : 'error');
    setErrorMsg(result.error ?? null);
    onEndedRef.current(result);
  }, []);

  const conversation = useConversation({
    onConnect: ({ conversationId }: { conversationId: string }) => {
      conversationIdRef.current = conversationId;
      setStatus('active');
      setAutoplayPrompt(false);
    },
    onDisconnect: () => {
      // If we haven't already emitted a terminal (user_ended via endVoice),
      // treat this as an agent-side disconnect — worth surfacing so the
      // respondent can retry rather than silently landing in "done".
      emitEnd({
        conversationId: conversationIdRef.current,
        transcript: transcriptRef.current,
        reason: endedRef.current ? 'user_ended' : 'agent_disconnected',
      });
    },
    onMessage: ({ message, source }: { message: string; source: string }) => {
      const turn: VoiceTurn = {
        role: source === 'ai' ? 'agent' : 'user',
        text: message,
      };
      transcriptRef.current = [...transcriptRef.current, turn];
      setTranscript(transcriptRef.current);
    },
    onModeChange: ({ mode }: { mode: string }) => {
      setAgentSpeaking(mode === 'speaking');
    },
    onError: (err: unknown) => {
      const raw = err instanceof Error ? err.message : String(err);
      // Heuristic mic-denied detection — the ElevenLabs SDK doesn't
      // distinguish permission from connection errors, so we sniff the
      // underlying DOMException/browser message text.
      const lower = raw.toLowerCase();
      const isMic =
        lower.includes('permission') ||
        lower.includes('notallowed') ||
        lower.includes('denied') ||
        lower.includes('microphone') ||
        lower.includes('getusermedia');
      emitEnd({
        conversationId: conversationIdRef.current,
        transcript: transcriptRef.current,
        reason: isMic ? 'mic_denied' : 'runtime_error',
        error: raw,
      });
    },
  });

  // Auto-start exactly once. React Strict Mode double-mounts in dev, so a
  // ref guards against a second call that would spawn a duplicate session.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/elevenlabs/signed-url?agentId=${encodeURIComponent(agentId)}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Signed URL fetch failed (${res.status})`);
        }
        const { signedUrl } = await res.json();
        if (cancelled) return;

        await conversation.startSession({
          signedUrl,
          ...(dynamicVariables ? { dynamicVariables } : {}),
        });
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : String(err);
        const lower = raw.toLowerCase();
        const isMic =
          lower.includes('permission') ||
          lower.includes('notallowed') ||
          lower.includes('denied') ||
          lower.includes('microphone');
        emitEnd({
          conversationId: null,
          transcript: [],
          reason: isMic ? 'mic_denied' : 'connect_failed',
          error: raw,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
    // `conversation` is stable across renders from the hook, `emitEnd` is
    // stable, and dynamicVariables are expected to be snapshot at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connection watchdog. If the session hasn't connected within 5s, some
  // browsers blocked audio autoplay — show a manual "Tap to start" fallback.
  useEffect(() => {
    if (status !== 'connecting') return;
    const t = setTimeout(() => {
      setAutoplayPrompt(true);
    }, 5000);
    return () => clearTimeout(t);
  }, [status]);

  const endVoice = useCallback(async () => {
    // Pre-mark as ended so the SDK's onDisconnect handler classifies this
    // as user_ended rather than agent_disconnected.
    endedRef.current = true;
    try {
      await conversation.endSession();
    } catch {
      // ignore — we'll emit end regardless
    }
    onEndedRef.current({
      conversationId: conversationIdRef.current,
      transcript: transcriptRef.current,
      reason: 'user_ended',
    });
  }, [conversation]);

  const handleSwitchToText = useCallback(async () => {
    endedRef.current = true;
    try {
      await conversation.endSession();
    } catch {
      // ignore
    }
    onSwitchToText();
  }, [conversation, onSwitchToText]);

  // Count completed user utterances as a rough question-index proxy.
  const userTurns = transcript.filter((t) => t.role === 'user').length;
  const progress =
    totalQuestions && totalQuestions > 0
      ? `Question ${Math.min(userTurns + 1, totalQuestions)} of ${totalQuestions}`
      : null;

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Autoplay-blocked fallback prompt — shown while we're stuck in
  // 'connecting' past the watchdog. A second user gesture unblocks audio
  // in browsers that require one (Mobile Safari on cold-visit).
  if (status === 'connecting' && autoplayPrompt) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center px-4 text-center">
        <p className="text-base text-foreground mb-4">
          Tap to start speaking
        </p>
        <p className="text-xs text-muted-foreground mb-6 max-w-xs">
          Your browser needs one tap to unlock audio. We&apos;ll pick up where
          the agent left off.
        </p>
        <button
          onClick={() => setAutoplayPrompt(false)}
          className="px-6 py-3 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors active:scale-[0.98]"
        >
          Start
        </button>
        <button
          onClick={handleSwitchToText}
          className="mt-6 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Switch to typing instead
        </button>
      </div>
    );
  }

  if (status === 'error') {
    // The parent will have already been called via emitEnd and will likely
    // be rendering its own error/fallback UI. This inline state is a brief
    // hold while that transition happens.
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center px-4 text-center">
        <AlertCircle className="h-10 w-10 text-destructive mb-3" />
        <p className="text-sm text-foreground">Connection issue</p>
        {errorMsg && (
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            {errorMsg}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-background"
      data-voice-session="active"
    >
      {/* Progress chip */}
      {progress && status === 'active' && (
        <div className="flex justify-center pt-6">
          <span className="text-xs text-muted-foreground px-3 py-1 rounded-full bg-muted/50">
            {progress}
          </span>
        </div>
      )}

      {/* Voice orb */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div
          className={cn(
            'relative h-32 w-32 rounded-full flex items-center justify-center transition-all duration-500',
            status === 'connecting'
              ? 'bg-muted/30'
              : agentSpeaking
                ? 'bg-primary/20 shadow-[0_0_60px_rgba(99,102,241,0.3)] scale-110'
                : 'bg-primary/10'
          )}
        >
          {agentSpeaking && (
            <span className="absolute inset-0 rounded-full border-2 border-primary/30 animate-pulse" />
          )}
          {agentSpeaking ? (
            <Volume2 className="h-10 w-10 text-primary" />
          ) : (
            <Mic className="h-10 w-10 text-foreground" />
          )}
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          {status === 'connecting'
            ? 'Connecting…'
            : agentSpeaking
              ? 'Listening to response…'
              : 'Your turn — speak when ready.'}
        </p>
      </div>

      {/* Live transcript */}
      {transcript.length > 0 && (
        <div className="max-h-[40vh] overflow-y-auto px-4 pb-4">
          <div className="mx-auto max-w-lg space-y-2">
            {transcript.map((entry, i) => (
              <div
                key={i}
                className={cn(
                  'flex',
                  entry.role === 'user' ? 'justify-end' : 'justify-start'
                )}
                data-voice-turn={entry.role}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-2 text-sm',
                    entry.role === 'user'
                      ? 'bg-primary/15 text-foreground'
                      : 'bg-muted/50 text-foreground'
                  )}
                >
                  {entry.text}
                </div>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      )}

      {/* Bottom bar — mobile-tappable (min-h-11 ≈ 44px iOS target) */}
      <div className="shrink-0 border-t border-border/40 px-4 py-3 flex items-center justify-between gap-3">
        <button
          onClick={handleSwitchToText}
          className="min-h-11 text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-voice-switch-to-text="true"
        >
          Switch to typing
        </button>
        <button
          onClick={endVoice}
          disabled={status !== 'active'}
          className="min-h-11 px-4 py-1.5 rounded-lg bg-muted text-sm font-medium text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
          data-voice-done="true"
        >
          Done
        </button>
      </div>
    </div>
  );
}
