'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useConversation } from '@elevenlabs/react';
import { useSurveyStore } from '@/lib/survey/store';
import { Mic, MicOff, Phone, PhoneOff, Loader2, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type InterviewStatus = 'idle' | 'connecting' | 'active' | 'ended';

interface VoiceInterviewProps {
  className?: string;
}

/**
 * Voice Interview component using ElevenLabs Conversational AI.
 * Uses the useConversation hook from @elevenlabs/react for WebRTC conversations.
 */
export function VoiceInterview({ className }: VoiceInterviewProps) {
  const [interviewStatus, setInterviewStatus] = useState<InterviewStatus>('idle');
  const [transcript, setTranscript] = useState<
    { role: 'agent' | 'user'; text: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const publishConfig = useSurveyStore((s) => s.publishConfig);
  const setVoiceInterviewActive = useSurveyStore((s) => s.setVoiceInterviewActive);
  const setActiveConversationId = useSurveyStore((s) => s.setActiveConversationId);

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: ({ conversationId }: { conversationId: string }) => {
      setInterviewStatus('active');
      setActiveConversationId(conversationId);
      setVoiceInterviewActive(true);
    },
    onDisconnect: () => {
      setInterviewStatus('ended');
      setVoiceInterviewActive(false);
    },
    onMessage: ({ message, source }: { message: string; source: string }) => {
      setTranscript((prev) => [
        ...prev,
        { role: source === 'ai' ? 'agent' : 'user', text: message },
      ]);
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Connection error';
      console.error('ElevenLabs conversation error:', error);
      setError(msg);
      setInterviewStatus('idle');
    },
  });

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const startConversation = useCallback(async () => {
    setError(null);
    setTranscript([]);
    setInterviewStatus('connecting');

    try {
      const agentId = publishConfig.agentId;
      if (!agentId) {
        throw new Error('Survey must be published first to enable voice interview');
      }

      // Get signed URL from our API
      const urlRes = await fetch(`/api/elevenlabs/signed-url?agentId=${agentId}`);
      if (!urlRes.ok) {
        const err = await urlRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to get conversation URL');
      }
      const { signedUrl } = await urlRes.json();

      // Start the conversation session via the hook
      await conversation.startSession({ signedUrl });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to start conversation';
      setError(msg);
      setInterviewStatus('idle');
    }
  }, [publishConfig.agentId, conversation]);

  const endConversation = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch {
      // Ignore cleanup errors
    }
    setInterviewStatus('ended');
    setVoiceInterviewActive(false);
  }, [conversation, setVoiceInterviewActive]);

  const hasAgent = !!publishConfig.agentId;
  const isAgentSpeaking = conversation.isSpeaking;

  return (
    <div className={cn('rounded-xl border border-border/40 bg-card overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center transition-colors',
              interviewStatus === 'active'
                ? isAgentSpeaking
                  ? 'bg-primary/20 text-primary animate-pulse'
                  : 'bg-green-500/20 text-green-400'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <Mic className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-medium">Voice Interview</div>
            <div className="text-[10px] text-muted-foreground">
              {interviewStatus === 'idle' && 'Ready to start'}
              {interviewStatus === 'connecting' && 'Connecting to AI agent...'}
              {interviewStatus === 'active' && (isAgentSpeaking ? 'Agent speaking...' : 'Listening...')}
              {interviewStatus === 'ended' && 'Interview complete'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {interviewStatus === 'active' && (
            <button
              onClick={() => conversation.setVolume({ volume: conversation.micMuted ? 1 : 0 })}
              className="h-8 w-8 rounded-full flex items-center justify-center bg-muted/40 hover:bg-muted transition-colors"
              title={conversation.micMuted ? 'Unmute' : 'Mute'}
            >
              {conversation.micMuted ? (
                <MicOff className="h-3.5 w-3.5 text-red-400" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-foreground" />
              )}
            </button>
          )}

          {interviewStatus === 'idle' || interviewStatus === 'ended' ? (
            <button
              onClick={startConversation}
              disabled={!hasAgent}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                hasAgent
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              <Phone className="h-3.5 w-3.5" />
              {interviewStatus === 'ended' ? 'Restart' : 'Start Interview'}
            </button>
          ) : interviewStatus === 'connecting' ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Connecting...
            </div>
          ) : (
            <button
              onClick={endConversation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              End
            </button>
          )}
        </div>
      </div>

      {/* Transcript */}
      {(transcript.length > 0 || interviewStatus === 'active') && (
        <div className="max-h-[300px] overflow-y-auto p-4 space-y-3">
          {transcript.map((entry, i) => (
            <div
              key={i}
              className={cn(
                'flex gap-2',
                entry.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed',
                  entry.role === 'user'
                    ? 'bg-primary/15 text-foreground'
                    : 'bg-muted/40 text-foreground'
                )}
              >
                {entry.text}
              </div>
            </div>
          ))}

          {interviewStatus === 'active' && isAgentSpeaking && (
            <div className="flex gap-2">
              <div className="bg-muted/40 rounded-xl px-3 py-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={transcriptEndRef} />
        </div>
      )}

      {/* No agent message */}
      {!hasAgent && interviewStatus === 'idle' && (
        <div className="p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Publish your survey first to enable voice interviews.
            <br />
            The AI agent will be created automatically.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 pb-3">
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
