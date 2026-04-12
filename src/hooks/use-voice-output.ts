'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVoiceOutputReturn {
  speak: (text: string) => Promise<void>;
  stop: () => void;
  isSpeaking: boolean;
}

/**
 * TTS hook — progressively streams audio from the synthesize endpoint.
 * Uses MediaSource API to start playback as soon as the first chunk arrives,
 * instead of waiting for the full response to download.
 *
 * Falls back to blob-based playback if MediaSource is unavailable.
 */
export function useVoiceOutput(): UseVoiceOutputReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
      audioRef.current = null;
    }
    mediaSourceRef.current = null;
  }, []);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    cleanup();
    setIsSpeaking(false);
  }, [cleanup]);

  /**
   * Streaming playback: pipe fetch response body into MediaSource SourceBuffer.
   * Audio starts playing as soon as the first chunk is appended.
   */
  const speakStreaming = useCallback(
    async (text: string, controller: AbortController) => {
      const res = await fetch('/api/ai/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`TTS failed (${res.status})`);
      if (!res.body) throw new Error('No response body');

      const mediaSource = new MediaSource();
      mediaSourceRef.current = mediaSource;

      const url = URL.createObjectURL(mediaSource);
      objectUrlRef.current = url;

      const audio = new Audio();
      audio.src = url;
      audioRef.current = audio;

      // Wait for MediaSource to be ready
      await new Promise<void>((resolve) => {
        mediaSource.addEventListener('sourceopen', () => resolve(), { once: true });
      });

      if (controller.signal.aborted) return;

      // Use audio/mpeg — the server sends mp3 chunks
      const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');

      const reader = res.body.getReader();
      let done = false;
      let started = false;

      // Queue to handle SourceBuffer's async nature (can't append while updating)
      const pendingChunks: Uint8Array[] = [];
      let appending = false;

      function appendNext() {
        if (appending || pendingChunks.length === 0) return;
        if (sourceBuffer.updating) return;

        appending = true;
        const chunk = pendingChunks.shift()!;
        try {
          sourceBuffer.appendBuffer(chunk.buffer as ArrayBuffer);
        } catch {
          // QuotaExceededError or other — stop appending
          appending = false;
          return;
        }
      }

      sourceBuffer.addEventListener('updateend', () => {
        appending = false;

        // Start playback as soon as we have some data buffered
        if (!started && audio.buffered.length > 0) {
          started = true;
          audio.play().catch(() => {});
        }

        if (pendingChunks.length > 0) {
          appendNext();
        } else if (done && !sourceBuffer.updating) {
          try {
            if (mediaSource.readyState === 'open') {
              mediaSource.endOfStream();
            }
          } catch {
            // Already ended
          }
        }
      });

      // Read from the stream and queue chunks
      while (true) {
        const { value, done: readerDone } = await reader.read();
        if (controller.signal.aborted) {
          reader.cancel();
          return;
        }
        if (readerDone) {
          done = true;
          // Signal end if no pending appends
          if (!sourceBuffer.updating && pendingChunks.length === 0) {
            try {
              if (mediaSource.readyState === 'open') {
                mediaSource.endOfStream();
              }
            } catch {
              // Already ended
            }
          }
          break;
        }
        if (value) {
          pendingChunks.push(value);
          appendNext();
        }
      }

      // Wait for audio to finish playing
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        // If audio already ended (very short clips)
        if (audio.ended) resolve();
      });
    },
    []
  );

  /**
   * Fallback: download full blob then play.
   * Used when MediaSource API is not available (e.g. some mobile browsers).
   */
  const speakFallback = useCallback(
    async (text: string, controller: AbortController) => {
      const res = await fetch('/api/ai/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`TTS failed (${res.status})`);

      const blob = await res.blob();
      if (controller.signal.aborted) return;

      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      await audio.play();

      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        if (audio.ended) resolve();
      });
    },
    []
  );

  const speak = useCallback(
    async (text: string) => {
      stop();
      if (!text.trim()) return;

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setIsSpeaking(true);

        // Use streaming if MediaSource is available
        const canStream =
          typeof MediaSource !== 'undefined' &&
          MediaSource.isTypeSupported('audio/mpeg');

        if (canStream) {
          await speakStreaming(text, controller);
        } else {
          await speakFallback(text, controller);
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('TTS error:', error);
        }
      } finally {
        if (!controller.signal.aborted) {
          cleanup();
          setIsSpeaking(false);
        }
      }
    },
    [stop, cleanup, speakStreaming, speakFallback]
  );

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { speak, stop, isSpeaking };
}
