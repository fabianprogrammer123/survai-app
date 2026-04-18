'use client';

import { useState } from 'react';
import { SurveyForm } from './survey-form';
import { VoiceSession, type VoiceEndResult } from './voice-session';
import { AnswerReadback } from './answer-readback';
import { Mic, MessageSquare, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SurveyElement } from '@/types/survey';

interface SurveyData {
  id: string;
  title: string;
  description: string;
  schema: SurveyElement[];
  settings: Record<string, unknown>;
  agent_id?: string;
}

type PageState =
  | 'welcome'
  | 'voice'
  | 'readback'
  | 'chat'
  | 'done'
  | 'error';

interface AnonymousSurveyProps {
  survey: SurveyData;
}

/**
 * Respondent flow for anonymous public links (/s/:id with no guest
 * token). Mirrors the guest voice experience but drops guest-specific
 * personalization: no greeting-by-name, no guest-token linking, no
 * pre-invite guard.
 *
 * Keeps the SurveyForm chat fallback so mic-denied / no-agent surveys
 * still work without a browser-side dead-end.
 */
export function AnonymousSurvey({ survey }: AnonymousSurveyProps) {
  const [pageState, setPageState] = useState<PageState>('welcome');
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const hasVoiceAgent = !!survey.agent_id;
  const questionCount = survey.schema.filter(
    (el) => !['section_header', 'page_break'].includes(el.type)
  ).length;

  // Rough estimate: ~20s per question on voice, capped to "< 1 min" for
  // tiny surveys and rounded to whole minutes above that.
  const estimatedMinutes = Math.max(1, Math.round((questionCount * 20) / 60));
  const estimateLabel =
    questionCount <= 3 ? 'under a minute' : `~${estimatedMinutes} min`;

  const handleVoiceEnded = (result: VoiceEndResult) => {
    if (result.reason === 'mic_denied') {
      setError(
        'We need microphone access to run the voice call. You can switch to typing instead.'
      );
      setPageState('welcome');
      return;
    }
    if (
      result.reason === 'connect_failed' ||
      result.reason === 'runtime_error'
    ) {
      setError(
        'Voice connection failed. Try again, or answer by typing instead.'
      );
      setPageState('welcome');
      return;
    }
    if (result.reason === 'agent_disconnected') {
      setError(
        'The call dropped. Your answers so far are saved — try again or switch to typing.'
      );
      setPageState('welcome');
      return;
    }
    if (result.conversationId) {
      setConversationId(result.conversationId);
      setPageState('readback');
    } else {
      setPageState('done');
    }
  };

  // ── Done ──
  if (pageState === 'done') {
    const msg =
      (survey.settings?.confirmationMessage as string | undefined) ||
      'Your answers are in. Thanks for your time!';
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <p className="text-2xl font-semibold text-foreground mb-2">
            All done!
          </p>
          <p className="text-muted-foreground">{msg}</p>
        </div>
      </div>
    );
  }

  // ── Read-back ──
  if (pageState === 'readback' && conversationId) {
    return (
      <AnswerReadback
        survey={survey}
        conversationId={conversationId}
        onSubmitted={() => setPageState('done')}
        onCancel={() => {
          setConversationId(null);
          setPageState('welcome');
        }}
      />
    );
  }

  // ── Voice mode ──
  if (pageState === 'voice' && survey.agent_id) {
    return (
      <VoiceSession
        agentId={survey.agent_id}
        totalQuestions={questionCount}
        onEnded={handleVoiceEnded}
        onSwitchToText={() => setPageState('chat')}
      />
    );
  }

  // ── Chat fallback ──
  if (pageState === 'chat') {
    return (
      <div className="min-h-screen bg-muted/30 py-6 sm:py-8 px-3 sm:px-4">
        <div className="mx-auto max-w-2xl">
          <SurveyForm
            survey={{
              ...survey,
              settings: {
                theme: 'default',
                showProgressBar: false,
                confirmationMessage:
                  (survey.settings?.confirmationMessage as string | undefined) ||
                  'Thanks for your response!',
                ...(survey.settings as Record<string, unknown>),
              },
            }}
          />
        </div>
      </div>
    );
  }

  // ── Welcome / landing ──
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="text-center max-w-md w-full">
        <h1
          className="text-3xl sm:text-4xl font-semibold text-foreground mb-3 break-words"
          data-anon-title="true"
        >
          {survey.title || 'Quick survey'}
        </h1>
        {survey.description && (
          <p className="text-base text-muted-foreground mb-6 break-words">
            {survey.description}
          </p>
        )}
        <p className="text-sm text-muted-foreground mb-10">
          {questionCount === 1
            ? `1 question · ${estimateLabel}`
            : `${questionCount} questions · ${estimateLabel}`}
        </p>

        <div className="space-y-3">
          {hasVoiceAgent && (
            <button
              onClick={() => {
                setError(null);
                setPageState('voice');
              }}
              className="w-full min-h-11 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-primary text-primary-foreground text-lg font-medium hover:bg-primary/90 transition-all active:scale-[0.98]"
              data-anon-cta="voice"
            >
              <Mic className="h-5 w-5" />
              Answer by voice
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
            data-anon-cta="typing"
          >
            <MessageSquare className="h-5 w-5" />
            Answer by typing
          </button>
        </div>

        {error && (
          <p className="mt-5 text-sm text-destructive" data-anon-error="true">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
