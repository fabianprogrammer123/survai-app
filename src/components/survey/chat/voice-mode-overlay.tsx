'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { useVoiceInput } from '@/hooks/use-voice-input';
import { useVoiceOutput } from '@/hooks/use-voice-output';
import { Mic, Square, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceModeOverlayProps {
  onSend: (text: string, inputMethod: 'voice') => void;
  isLoading: boolean;
}

/**
 * Full voice-mode UI — replaces text input with a central mic button.
 * Messages still appear in the chat feed behind this overlay.
 * Similar to OpenAI voice mode: big glowing mic, auto-send on stop.
 */
export function VoiceModeOverlay({ onSend, isLoading }: VoiceModeOverlayProps) {
  const voice = useVoiceInput();
  const tts = useVoiceOutput();
  const chatMessages = useSurveyStore((s) => s.chatMessages);
  const voiceEnabled = useSurveyStore((s) => s.voiceEnabled);
  const setChatMode = useSurveyStore((s) => s.setChatMode);
  const [statusLabel, setStatusLabel] = useState<string>('Tap to speak');

  // Auto-start TTS for new assistant messages (debounced, skipped while recording)
  const lastSpokenRef = useRef<string | null>(null);
  const ttsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!voiceEnabled || chatMessages.length === 0) return;
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (lastMsg.role === 'assistant' && lastMsg.id !== lastSpokenRef.current && !lastMsg.isError) {
      // Clear any pending TTS trigger
      if (ttsTimeoutRef.current) clearTimeout(ttsTimeoutRef.current);

      // Don't auto-speak while user is recording
      if (voice.state === 'recording') return;

      // Debounce to avoid triggering on rapidly updating messages
      ttsTimeoutRef.current = setTimeout(() => {
        lastSpokenRef.current = lastMsg.id;
        tts.speak(lastMsg.content);
      }, 300);
    }
    return () => {
      if (ttsTimeoutRef.current) clearTimeout(ttsTimeoutRef.current);
    };
  }, [chatMessages, voiceEnabled, tts, voice.state]);

  // Update status label based on state
  useEffect(() => {
    if (tts.isSpeaking) {
      setStatusLabel('Listening to response...');
    } else if (isLoading) {
      setStatusLabel('Thinking...');
    } else if (voice.state === 'recording') {
      setStatusLabel('Listening...');
    } else if (voice.state === 'transcribing') {
      setStatusLabel('Processing...');
    } else {
      setStatusLabel('Tap to speak');
    }
  }, [voice.state, isLoading, tts.isSpeaking]);

  const handleMicClick = useCallback(async () => {
    if (voice.state === 'recording') {
      // Stop recording → transcribe → auto-send
      const transcription = await voice.stopRecording();
      if (transcription.trim()) {
        tts.stop(); // Stop any playing TTS
        onSend(transcription, 'voice');
      }
    } else if (voice.state === 'idle' && !isLoading) {
      // Stop current TTS and start recording
      tts.stop();
      voice.startRecording();
    }
  }, [voice, tts, onSend, isLoading]);

  // Determine the visual state of the orb
  const isActive = voice.state === 'recording';
  const isBusy = voice.state === 'transcribing' || isLoading;
  const isPlaying = tts.isSpeaking;

  // Dynamic orb scale based on audio level when recording
  const orbScale = isActive ? 1 + voice.audioLevel * 0.3 : isPlaying ? 1.05 : 1;

  return (
    <div className="relative flex flex-col items-center justify-center py-6 px-4 shrink-0 border-t bg-background">
      {/* Close button */}
      <button
        onClick={() => {
          tts.stop();
          voice.cancelRecording();
          setChatMode('text');
        }}
        className="absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Switch to text mode"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Voice orb */}
      <button
        onClick={handleMicClick}
        disabled={isBusy}
        className={cn(
          'relative h-20 w-20 rounded-full flex items-center justify-center transition-all duration-300',
          isActive && 'bg-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.3)]',
          isPlaying && 'bg-primary/20 shadow-[0_0_40px_rgba(99,102,241,0.3)]',
          isBusy && 'bg-muted/40',
          !isActive && !isPlaying && !isBusy && 'bg-primary/10 hover:bg-primary/20 hover:shadow-[0_0_30px_rgba(99,102,241,0.2)]'
        )}
        style={{ transform: `scale(${orbScale})` }}
      >
        {/* Pulsing ring when recording */}
        {isActive && (
          <span className="absolute inset-0 rounded-full border-2 border-red-500/40 animate-ping" />
        )}
        {/* Pulsing ring when AI speaking */}
        {isPlaying && (
          <span className="absolute inset-0 rounded-full border-2 border-primary/30 animate-pulse" />
        )}

        {isBusy ? (
          <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
        ) : isActive ? (
          <Square className="h-6 w-6 text-red-500 fill-red-500" />
        ) : (
          <Mic className={cn('h-8 w-8', isPlaying ? 'text-primary' : 'text-foreground')} />
        )}
      </button>

      {/* Status text */}
      <p className={cn(
        'mt-3 text-xs font-medium transition-colors',
        isActive ? 'text-red-400' : isPlaying ? 'text-primary' : 'text-muted-foreground'
      )}>
        {statusLabel}
      </p>

      {/* Audio level indicator */}
      {isActive && (
        <div className="flex items-end gap-[3px] mt-2 h-4">
          {Array.from({ length: 7 }).map((_, i) => {
            const h = Math.max(3, voice.audioLevel * 16 * Math.sin((i + 1) * 0.7));
            return (
              <span
                key={i}
                className="w-[3px] rounded-full bg-red-400 transition-all duration-75"
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
