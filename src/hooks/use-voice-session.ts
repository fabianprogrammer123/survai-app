'use client';

import { useCallback, useRef, useState } from 'react';
import { useConversation } from '@elevenlabs/react';

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

export type VoiceStatus = 'idle' | 'connecting' | 'active' | 'ended';

export interface UseVoiceSessionReturn {
  status: VoiceStatus;
  conversationId: string | null;
  transcript: VoiceTurn[];
  agentSpeaking: boolean;
  start: (params: {
    agentId: string;
    dynamicVariables?: Record<string, string | number | boolean>;
  }) => Promise<void>;
  end: () => Promise<void>;
}

/**
 * Thin wrapper around ElevenLabs `useConversation` that exposes an
 * imperative `start` the caller invokes directly from the user's click
 * handler. The ElevenLabs SDK requires a live user-gesture to open the
 * mic and unlock audio autoplay; triggering `startSession` from a mount
 * effect loses that gesture (and races React Strict Mode's double
 * invocation).
 *
 * Callers own the terminal-transition decision: `onEnded` fires exactly
 * once when any terminal reason is reached.
 */
export function useVoiceSession(onEnded?: (result: VoiceEndResult) => void) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<VoiceTurn[]>([]);
  const [agentSpeaking, setAgentSpeaking] = useState(false);

  // Refs keep SDK callbacks from capturing stale state.
  const conversationIdRef = useRef<string | null>(null);
  const transcriptRef = useRef<VoiceTurn[]>([]);
  const endedRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const emitEnd = useCallback((result: VoiceEndResult) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setStatus('ended');
    onEndedRef.current?.(result);
  }, []);

  const conversation = useConversation({
    onConnect: ({ conversationId: id }) => {
      conversationIdRef.current = id;
      setConversationId(id);
      setStatus('active');
    },
    onDisconnect: (details) => {
      let reason: VoiceEndReason;
      let errText: string | undefined;
      if (endedRef.current) return; // already handled via end()
      if (details?.reason === 'user') reason = 'user_ended';
      else if (details?.reason === 'agent') reason = 'agent_disconnected';
      else if (details?.reason === 'error') {
        reason = 'runtime_error';
        errText =
          'message' in details && typeof details.message === 'string'
            ? details.message
            : undefined;
      } else reason = 'agent_disconnected';
      emitEnd({
        conversationId: conversationIdRef.current,
        transcript: transcriptRef.current,
        reason,
        error: errText,
      });
    },
    onMessage: ({ message, source }) => {
      const turn: VoiceTurn = {
        role: source === 'ai' ? 'agent' : 'user',
        text: message,
      };
      transcriptRef.current = [...transcriptRef.current, turn];
      setTranscript(transcriptRef.current);
    },
    onModeChange: ({ mode }) => {
      setAgentSpeaking(mode === 'speaking');
    },
    onError: (message) => {
      const raw = String(message);
      const lower = raw.toLowerCase();
      const isMic =
        lower.includes('permission') ||
        lower.includes('notallowed') ||
        lower.includes('denied') ||
        lower.includes('microphone');
      emitEnd({
        conversationId: conversationIdRef.current,
        transcript: transcriptRef.current,
        reason: isMic ? 'mic_denied' : 'runtime_error',
        error: raw,
      });
    },
  });

  const start = useCallback(
    async ({
      agentId,
      dynamicVariables,
    }: {
      agentId: string;
      dynamicVariables?: Record<string, string | number | boolean>;
    }) => {
      // Reset state for a fresh session — supports "retry" without
      // remounting the component tree.
      conversationIdRef.current = null;
      transcriptRef.current = [];
      endedRef.current = false;
      setConversationId(null);
      setTranscript([]);
      setAgentSpeaking(false);
      setStatus('connecting');

      try {
        // DO NOT preflight getUserMedia here. The earlier version did,
        // to surface a clean "mic_denied" reason, but every extra await
        // between the user's click and `startSession()` risks the
        // browser's audio-unlock gesture going stale: the AudioContext
        // the SDK creates then starts in 'suspended' state and all
        // agent audio is silently dropped. The SDK acquires the mic
        // internally inside startSession and reports permission errors
        // through onError — heuristic-sniff those in the callback.
        //
        // Parallelize the signed-URL fetch so we reach startSession as
        // fast as possible.
        const [signedUrlJson] = await Promise.all([
          fetch(
            `/api/elevenlabs/signed-url?agentId=${encodeURIComponent(agentId)}`
          ).then(async (r) => {
            if (!r.ok) {
              const body = await r.json().catch(() => ({}));
              throw new Error(
                body.error || `Signed URL fetch failed (${r.status})`
              );
            }
            return r.json() as Promise<{ signedUrl: string }>;
          }),
        ]);

        await conversation.startSession({
          signedUrl: signedUrlJson.signedUrl,
          connectionType: 'websocket',
          ...(dynamicVariables ? { dynamicVariables } : {}),
        });
        // onConnect flips status → 'active'. If it never fires, the SDK
        // will surface the failure via onError or onDisconnect(reason='error').
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        // Heuristic mic-denied detection — since we no longer preflight.
        const lower = raw.toLowerCase();
        const isMic =
          lower.includes('permission') ||
          lower.includes('notallowed') ||
          lower.includes('denied') ||
          lower.includes('microphone');
        emitEnd({
          conversationId: conversationIdRef.current,
          transcript: transcriptRef.current,
          reason: isMic ? 'mic_denied' : 'connect_failed',
          error: raw,
        });
      }
    },
    [conversation, emitEnd]
  );

  const end = useCallback(async () => {
    // Pre-mark so onDisconnect knows this was user-initiated; avoids a
    // duplicate emitEnd race.
    endedRef.current = true;
    try {
      await conversation.endSession();
    } catch {
      // ignore — we emit user_ended regardless.
    }
    onEndedRef.current?.({
      conversationId: conversationIdRef.current,
      transcript: transcriptRef.current,
      reason: 'user_ended',
    });
    setStatus('ended');
  }, [conversation]);

  return {
    status,
    conversationId,
    transcript,
    agentSpeaking,
    start,
    end,
  };
}
