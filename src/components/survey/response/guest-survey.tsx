'use client';

import { useState, useEffect } from 'react';
import { SurveyForm } from './survey-form';
import { VoiceSession, type VoiceEndResult } from './voice-session';
import { Mic, MessageSquare, Loader2, CheckCircle } from 'lucide-react';
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

  const firstName = guest?.name?.split(' ')[0] || 'there';
  const hasVoiceAgent = !!serverSurvey.agent_id;

  const questionCount = serverSurvey.schema.filter(
    (el) => !['section_header', 'page_break'].includes(el.type)
  ).length;

  const handleVoiceEnded = (result: VoiceEndResult) => {
    // Guest flow: the ElevenLabs post-call webhook handles persistence +
    // guest linking end-to-end, so reaching the end screen is sufficient
    // for this variant. The anonymous /s/:id flow — which doesn't rely on
    // pre-invited guests — adds a read-back/verify step on top (added in
    // a follow-up commit).
    if (result.reason === 'mic_denied') {
      setError('We need mic access to run the voice call. Switch to typing?');
      setPageState('welcome');
      return;
    }
    if (result.reason === 'connect_failed' || result.reason === 'runtime_error') {
      setError('Voice connection failed. You can try again or switch to typing.');
      setPageState('welcome');
      return;
    }
    if (result.reason === 'agent_disconnected') {
      setError('The call dropped. Your answers so far are saved — try again or switch to typing.');
      setPageState('welcome');
      return;
    }
    setPageState('done');
  };

  // ── Loading ──
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Error (hard) ──
  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <p className="text-lg font-medium text-foreground mb-2">Hmm, that didn&apos;t work</p>
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

  // ── Voice mode ──
  if (pageState === 'voice') {
    if (!serverSurvey.agent_id || !guest) {
      // Shouldn't happen — the welcome CTA guards on hasVoiceAgent — but
      // defend against direct state mutation anyway.
      setPageState('welcome');
      return null;
    }
    return (
      <VoiceSession
        agentId={serverSurvey.agent_id}
        dynamicVariables={{ guest_name: guest.name }}
        totalQuestions={questionCount}
        onEnded={handleVoiceEnded}
        onSwitchToText={() => setPageState('chat')}
      />
    );
  }

  // ── Welcome screen ──
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
              onClick={() => {
                setError(null);
                setPageState('voice');
              }}
              className="w-full min-h-11 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-primary text-primary-foreground text-lg font-medium hover:bg-primary/90 transition-all active:scale-[0.98]"
            >
              <Mic className="h-5 w-5" />
              Talk to me
            </button>
          )}

          <button
            onClick={() => setPageState('chat')}
            className={cn(
              'w-full min-h-11 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-lg font-medium transition-all active:scale-[0.98]',
              hasVoiceAgent
                ? 'bg-muted text-foreground hover:bg-muted/80'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            <MessageSquare className="h-5 w-5" />
            I&apos;ll type it
          </button>
        </div>

        {error && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  );
}
