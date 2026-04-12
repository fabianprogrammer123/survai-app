'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useConversation } from '@elevenlabs/react';
import { useSurveyStore } from '@/lib/survey/store';
import { Mic, MessageSquare, Loader2, CheckCircle, Volume2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type PageState = 'setup' | 'welcome' | 'voice' | 'done';

/**
 * /test/guest — test the personalized guest voice experience
 * without needing Supabase. Uses the store's agentId from publish.
 */
export default function TestGuestPage() {
  const [pageState, setPageState] = useState<PageState>('setup');
  const [guestName, setGuestName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<{ role: 'agent' | 'user'; text: string }[]>([]);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const storeAgentId = useSurveyStore((s) => s.publishConfig.agentId);
  const surveyTitle = useSurveyStore((s) => s.survey.title);

  // Accept agentId from store (after publish) or from URL query param (for direct testing)
  const [urlAgentId] = useState(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('agentId');
  });
  const agentId = storeAgentId || urlAgentId;

  const conversation = useConversation({
    onConnect: () => {
      setPageState('voice');
    },
    onDisconnect: () => {
      if (pageState === 'voice') {
        setPageState('done');
      }
    },
    onMessage: ({ message, source }: { message: string; source: string }) => {
      setTranscript((prev) => [
        ...prev,
        { role: source === 'ai' ? 'agent' : 'user', text: message },
      ]);
    },
    onModeChange: ({ mode }: { mode: string }) => {
      setAgentSpeaking(mode === 'speaking');
    },
    onError: (err: unknown) => {
      console.error('Voice error:', err);
      setError('Voice connection failed. Check console for details.');
    },
  });

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const startVoice = useCallback(async () => {
    if (!agentId || !guestName.trim()) return;

    setError(null);
    setTranscript([]);

    try {
      const res = await fetch(`/api/elevenlabs/signed-url?agentId=${agentId}`);
      if (!res.ok) throw new Error('Failed to get signed URL');
      const { signedUrl } = await res.json();

      await conversation.startSession({
        signedUrl,
        dynamicVariables: {
          guest_name: guestName.trim(),
        },
      });
    } catch (err) {
      console.error('Start voice error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start');
    }
  }, [agentId, guestName, conversation]);

  const endVoice = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch {
      // ignore
    }
    setPageState('done');
  }, [conversation]);

  const firstName = guestName.split(' ')[0] || 'there';

  // ── Setup: enter name ──
  if (pageState === 'setup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md w-full">
          <h1 className="text-2xl font-semibold mb-2">Test Guest Experience</h1>
          <p className="text-sm text-muted-foreground mb-8">
            {agentId
              ? `Agent ready for "${surveyTitle}". Enter a name to test the personalized voice interview.`
              : 'No agent found. Go to /test, build a survey, and publish it first.'}
          </p>

          {agentId ? (
            <>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Enter guest name (e.g. Sarah)"
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-center text-lg placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mb-4"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && guestName.trim()) {
                    setPageState('welcome');
                  }
                }}
              />
              <button
                onClick={() => setPageState('welcome')}
                disabled={!guestName.trim()}
                className={cn(
                  'w-full px-6 py-4 rounded-2xl text-lg font-medium transition-all',
                  guestName.trim()
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
              >
                Preview as this guest
              </button>
            </>
          ) : (
            <a
              href="/test"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <ArrowLeft className="h-4 w-4" />
              Go to editor
            </a>
          )}

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        </div>
      </div>
    );
  }

  // ── Welcome ──
  if (pageState === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md w-full">
          <p className="text-3xl font-semibold text-foreground mb-2">
            Hey {firstName}!
          </p>
          <p className="text-lg text-muted-foreground mb-10">
            Just a couple quick things to ask you.
          </p>

          <div className="space-y-3">
            <button
              onClick={startVoice}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-primary text-primary-foreground text-lg font-medium hover:bg-primary/90 transition-all active:scale-[0.98]"
            >
              <Mic className="h-5 w-5" />
              Talk to me
            </button>

            <button
              onClick={() => setPageState('setup')}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-muted text-foreground text-lg font-medium hover:bg-muted/80 transition-all active:scale-[0.98]"
            >
              <MessageSquare className="h-5 w-5" />
              I'll type it
            </button>
          </div>

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        </div>
      </div>
    );
  }

  // ── Done ──
  if (pageState === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <p className="text-2xl font-semibold text-foreground mb-2">
            Thanks, {firstName}!
          </p>
          <p className="text-muted-foreground mb-6">
            Your answers are in. See you soon!
          </p>
          <div className="space-y-2">
            <button
              onClick={() => {
                setTranscript([]);
                setPageState('setup');
              }}
              className="px-4 py-2 rounded-lg bg-muted text-sm font-medium text-foreground hover:bg-muted/80 transition-colors"
            >
              Test with another name
            </button>
          </div>

          {transcript.length > 0 && (
            <div className="mt-8 text-left">
              <p className="text-xs font-medium text-muted-foreground mb-2">Transcript:</p>
              <div className="max-h-[300px] overflow-y-auto space-y-1 rounded-xl border border-border/40 p-3">
                {transcript.map((entry, i) => (
                  <div key={i} className="text-xs">
                    <span className={cn('font-medium', entry.role === 'agent' ? 'text-primary' : 'text-foreground')}>
                      {entry.role === 'agent' ? 'Agent' : firstName}:
                    </span>{' '}
                    <span className="text-muted-foreground">{entry.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Voice mode ──
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <button
          onClick={agentSpeaking ? undefined : endVoice}
          className={cn(
            'relative h-32 w-32 rounded-full flex items-center justify-center transition-all duration-500',
            agentSpeaking
              ? 'bg-primary/20 shadow-[0_0_60px_rgba(99,102,241,0.3)] scale-110'
              : 'bg-primary/10 hover:bg-primary/15'
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
        </button>

        <p className="mt-6 text-sm text-muted-foreground">
          {agentSpeaking ? 'Listening to response...' : 'Listening to you...'}
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

      <div className="shrink-0 border-t border-border/40 px-4 py-3 flex items-center justify-center">
        <button
          onClick={endVoice}
          className="px-6 py-2 rounded-lg bg-muted text-sm font-medium text-foreground hover:bg-muted/80 transition-colors"
        >
          End conversation
        </button>
      </div>
    </div>
  );
}
