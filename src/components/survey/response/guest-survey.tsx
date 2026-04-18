'use client';

import { useCallback, useEffect, useState } from 'react';
import { SurveyForm } from './survey-form';
import { VoiceSession } from './voice-session';
import { AnswerReadback } from './answer-readback';
import {
  useVoiceSession,
  type VoiceEndResult,
} from '@/hooks/use-voice-session';
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

type PageState =
  | 'loading'
  | 'welcome'
  | 'voice'
  | 'readback'
  | 'chat'
  | 'done'
  | 'error';

interface GuestSurveyProps {
  surveyId: string;
  token: string;
  survey: SurveyData;
}

export function GuestSurvey({ surveyId, token, survey: serverSurvey }: GuestSurveyProps) {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [guest, setGuest] = useState<GuestData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedConversationId, setSavedConversationId] = useState<string | null>(
    null
  );

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

  const handleVoiceEnded = useCallback((result: VoiceEndResult) => {
    if (result.reason === 'mic_denied') {
      setError('We need mic access to run the voice call. Switch to typing?');
      setPageState('welcome');
      return;
    }
    if (result.reason === 'connect_failed' || result.reason === 'runtime_error') {
      setError(
        `Voice connection failed${result.error ? ` (${result.error})` : ''}. You can try again or switch to typing.`
      );
      setPageState('welcome');
      return;
    }
    if (result.reason === 'agent_disconnected') {
      setError('The call dropped. Your answers so far are saved — try again or switch to typing.');
      setPageState('welcome');
      return;
    }
    if (result.conversationId) {
      setSavedConversationId(result.conversationId);
      setPageState('readback');
    } else {
      setPageState('done');
    }
  }, []);

  const voice = useVoiceSession(handleVoiceEnded);

  const handleStartVoice = useCallback(async () => {
    if (!serverSurvey.agent_id || !guest) return;
    setError(null);
    setPageState('voice');
    await voice.start({
      agentId: serverSurvey.agent_id,
      // Defensive fallback — in practice the guests row always has a
      // non-empty name, but we never want the agent's greeting template
      // (which references {{guest_name}}) to fail to resolve.
      dynamicVariables: { guest_name: guest.name || 'there' },
    });
  }, [serverSurvey.agent_id, guest, voice]);

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

  // ── Read-back ──
  if (pageState === 'readback' && savedConversationId) {
    return (
      <AnswerReadback
        survey={serverSurvey}
        conversationId={savedConversationId}
        guestToken={token}
        onSubmitted={() => setPageState('done')}
        onCancel={() => {
          setSavedConversationId(null);
          setPageState('welcome');
        }}
      />
    );
  }

  // ── Voice ──
  if (pageState === 'voice') {
    return (
      <VoiceSession
        status={voice.status}
        transcript={voice.transcript}
        agentSpeaking={voice.agentSpeaking}
        totalQuestions={questionCount}
        onEnd={voice.end}
        onSwitchToText={async () => {
          await voice.end();
          setPageState('chat');
        }}
      />
    );
  }

  // ── Chat mode ──
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

  // ── Welcome ──
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
              onClick={handleStartVoice}
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
