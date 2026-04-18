'use client';

import { useEffect, useRef } from 'react';
import { Mic, Volume2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  VoiceStatus,
  VoiceTurn,
} from '@/hooks/use-voice-session';

export type { VoiceTurn, VoiceEndResult, VoiceEndReason } from '@/hooks/use-voice-session';

interface VoiceSessionProps {
  status: VoiceStatus;
  transcript: VoiceTurn[];
  agentSpeaking: boolean;
  // Rough progress signal: "Question N of total". When the total is
  // unknown (e.g. zero questions) the chip is hidden.
  totalQuestions?: number;
  onEnd: () => void;
  onSwitchToText: () => void;
}

/**
 * Presentational shell for a running ElevenLabs voice conversation.
 * All session lifecycle (start / end / SDK callbacks) lives in the
 * `useVoiceSession` hook owned by the parent — the parent calls
 * `start()` directly from its onClick so the browser's user-gesture
 * requirement for mic + audio is satisfied.
 */
export function VoiceSession({
  status,
  transcript,
  agentSpeaking,
  totalQuestions,
  onEnd,
  onSwitchToText,
}: VoiceSessionProps) {
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const userTurns = transcript.filter((t) => t.role === 'user').length;
  const progress =
    totalQuestions && totalQuestions > 0
      ? `Question ${Math.min(userTurns + 1, totalQuestions)} of ${totalQuestions}`
      : null;

  if (status === 'ended') {
    // Parent will typically have already transitioned to readback / done.
    // Render a neutral placeholder for the one-render gap.
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <span className="text-sm text-muted-foreground">One moment…</span>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-background"
      data-voice-session={status}
    >
      {progress && status === 'active' && (
        <div className="flex justify-center pt-6">
          <span className="text-xs text-muted-foreground px-3 py-1 rounded-full bg-muted/50">
            {progress}
          </span>
        </div>
      )}

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
          {status === 'connecting' ? (
            <div className="flex gap-1">
              <span
                className="w-2 h-2 rounded-full bg-foreground/60 animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="w-2 h-2 rounded-full bg-foreground/60 animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <span
                className="w-2 h-2 rounded-full bg-foreground/60 animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </div>
          ) : agentSpeaking ? (
            <Volume2 className="h-10 w-10 text-primary" />
          ) : (
            <Mic className="h-10 w-10 text-foreground" />
          )}
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          {status === 'connecting'
            ? 'Connecting…'
            : agentSpeaking
              ? 'Agent is speaking…'
              : 'Your turn — speak when ready.'}
        </p>
      </div>

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

      <div className="shrink-0 border-t border-border/40 px-4 py-3 flex items-center justify-between gap-3">
        <button
          onClick={onSwitchToText}
          className="min-h-11 text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-voice-switch-to-text="true"
        >
          Switch to typing
        </button>
        <button
          onClick={onEnd}
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

/**
 * Full-screen error placeholder used by callers when the hook emits a
 * terminal reason before reaching 'active'. Keeps the visual shell
 * consistent with the live session while the parent decides what to do.
 */
export function VoiceSessionError({ message }: { message?: string }) {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center px-4 text-center">
      <AlertCircle className="h-10 w-10 text-destructive mb-3" />
      <p className="text-sm text-foreground">Connection issue</p>
      {message && (
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">{message}</p>
      )}
    </div>
  );
}
