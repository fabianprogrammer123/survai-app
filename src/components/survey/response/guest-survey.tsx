'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useConversation } from '@elevenlabs/react';
import { SurveyForm } from './survey-form';
import { Mic, MessageSquare, Loader2, CheckCircle, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SurveyElement } from '@/types/survey';

interface GuestData {
  id: string;
  name: string;
  token: string;
  status: string;
  profile?: unknown;
}

interface SurveyData {
  id: string;
  title: string;
  description: string;
  schema: SurveyElement[];
  settings: Record<string, unknown>;
  agent_id?: string;
}

type PageState = 'loading' | 'welcome' | 'voice' | 'chat' | 'done' | 'error';

interface GuestSurveyProps {
  surveyId: string;
  token: string;
  survey: SurveyData;
}

export function GuestSurvey({ surveyId, token, survey: serverSurvey }: GuestSurveyProps) {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [guest, setGuest] = useState<GuestData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<{ role: 'agent' | 'user'; text: string }[]>([]);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Fetch guest data on mount
  useEffect(() => {
    fetch(`/api/surveys/${surveyId}/guests/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error('Invalid invite link');
        return res.json();
      })
      .then((data) => {
        setGuest(data.guest);
        if (data.guest.status === 'completed') {
          setPageState('done');
        } else {
          setPageState('welcome');
        }
      })
      .catch((err) => {
        setError(err.message || 'Something went wrong');
        setPageState('error');
      });
  }, [surveyId, token]);

  // ElevenLabs conversation
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
      setError('Voice connection failed. Try the chat option instead.');
    },
  });

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const startVoice = useCallback(async () => {
    if (!serverSurvey.agent_id || !guest) return;

    setError(null);
    setTranscript([]);

    try {
      const res = await fetch(`/api/elevenlabs/signed-url?agentId=${serverSurvey.agent_id}`);
      if (!res.ok) throw new Error('Failed to connect');
      const { signedUrl } = await res.json();

      await conversation.startSession({
        signedUrl,
        dynamicVariables: {
          guest_name: guest.name,
        },
      });
    } catch (err) {
      console.error('Start voice error:', err);
      setError('Could not start voice. Try the chat option.');
    }
  }, [serverSurvey.agent_id, guest, conversation]);

  const endVoice = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch {
      // ignore
    }
    setPageState('done');
  }, [conversation]);

  const firstName = guest?.name?.split(' ')[0] || 'there';
  const hasVoiceAgent = !!serverSurvey.agent_id;

  // ── Loading ──
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Error ──
  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <p className="text-lg font-medium text-foreground mb-2">Hmm, that didn't work</p>
          <p className="text-sm text-muted-foreground">{error || 'This link may be invalid or expired.'}</p>
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
          <p className="text-muted-foreground">
            Your answers are in. See you soon!
          </p>
        </div>
      </div>
    );
  }

  // ── Chat mode (fallback) ──
  if (pageState === 'chat') {
    return (
      <div className="min-h-screen bg-muted/30 py-8 px-4">
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground">
              Hey {firstName} — just fill this out real quick.
            </p>
          </div>
          <SurveyForm
            guestToken={token}
            survey={{
              ...serverSurvey,
              settings: {
                theme: 'default',
                showProgressBar: false,
                confirmationMessage: `Thanks ${firstName}! Your answers are in.`,
                ...(serverSurvey.settings as Record<string, unknown>),
              },
            }}
          />
        </div>
      </div>
    );
  }

  // ── Welcome screen ──
  if (pageState === 'welcome') {
    const questionCount = serverSurvey.schema.filter(
      (el) => !['section_header', 'page_break'].includes(el.type)
    ).length;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md w-full">
          <p className="text-3xl font-semibold text-foreground mb-2">
            Hey {firstName}!
          </p>
          <p className="text-lg text-muted-foreground mb-10">
            {questionCount <= 3
              ? `Just ${questionCount} quick thing${questionCount !== 1 ? 's' : ''} to ask you.`
              : `Got ${questionCount} quick questions — takes 2 min.`}
          </p>

          <div className="space-y-3">
            {hasVoiceAgent && (
              <button
                onClick={startVoice}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-primary text-primary-foreground text-lg font-medium hover:bg-primary/90 transition-all active:scale-[0.98]"
              >
                <Mic className="h-5 w-5" />
                Talk to me
              </button>
            )}

            <button
              onClick={() => setPageState('chat')}
              className={cn(
                'w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-lg font-medium transition-all active:scale-[0.98]',
                hasVoiceAgent
                  ? 'bg-muted text-foreground hover:bg-muted/80'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              <MessageSquare className="h-5 w-5" />
              I'll type it
            </button>
          </div>

          {error && (
            <p className="mt-4 text-sm text-destructive">{error}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Voice mode ──
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Centered voice UI */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {/* Voice orb */}
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

      {/* Bottom bar */}
      <div className="shrink-0 border-t border-border/40 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => {
            endVoice();
            setPageState('chat');
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Switch to typing
        </button>
        <button
          onClick={endVoice}
          className="px-4 py-1.5 rounded-lg bg-muted text-sm font-medium text-foreground hover:bg-muted/80 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
