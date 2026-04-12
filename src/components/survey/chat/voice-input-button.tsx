'use client';

import { Mic, Loader2, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceInputButtonProps {
  state: 'idle' | 'recording' | 'transcribing';
  isSupported: boolean;
  audioLevel: number;
  onStart: () => void;
  onStop: () => void;
}

export function VoiceInputButton({
  state,
  isSupported,
  audioLevel,
  onStart,
  onStop,
}: VoiceInputButtonProps) {
  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={state === 'recording' ? onStop : onStart}
      disabled={state === 'transcribing'}
      className={cn(
        'relative h-10 w-10 rounded-xl flex items-center justify-center transition-all shrink-0',
        state === 'idle' && 'text-muted-foreground hover:text-foreground hover:bg-muted',
        state === 'recording' && 'text-red-500 bg-red-50 voice-recording',
        state === 'transcribing' && 'text-muted-foreground opacity-60'
      )}
      title={
        state === 'recording'
          ? 'Stop recording'
          : state === 'transcribing'
            ? 'Transcribing...'
            : 'Start voice input'
      }
    >
      {state === 'recording' && (
        <>
          {/* Animated waveform bars */}
          <div className="absolute inset-0 flex items-center justify-center gap-0.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="waveform-bar bg-red-500"
                style={{
                  animationDelay: `${i * 0.15}s`,
                  height: `${4 + audioLevel * 12}px`,
                }}
              />
            ))}
          </div>
        </>
      )}

      {state === 'transcribing' ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : state === 'recording' ? (
        <Square className="h-3 w-3 relative z-10 fill-red-500" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  );
}
