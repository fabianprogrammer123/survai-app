'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

type VoiceState = 'idle' | 'recording' | 'transcribing';

interface UseVoiceInputReturn {
  state: VoiceState;
  isSupported: boolean;
  startRecording: () => void;
  stopRecording: () => Promise<string>;
  cancelRecording: () => void;
  audioLevel: number;
}

export function useVoiceInput(): UseVoiceInputReturn {
  const [state, setState] = useState<VoiceState>('idle');
  const [isSupported, setIsSupported] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const resolveRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    setIsSupported(
      typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== 'undefined'
    );
  }, []);

  const cleanup = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setAudioLevel(0);
  }, []);

  const startRecording = useCallback(async () => {
    if (!isSupported) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analysis for level metering
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Animate audio level — use time-domain RMS for smoother metering
      const dataArray = new Float32Array(analyser.fftSize);
      function updateLevel() {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(dataArray);
        // RMS calculation for smooth, accurate audio level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        // Map RMS (typically 0-0.5 for speech) to 0-1 with a nice curve
        setAudioLevel(Math.min(rms * 4, 1));
        animationRef.current = requestAnimationFrame(updateLevel);
      }
      updateLevel();

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) {
          resolveRef.current?.('');
          cleanup();
          setState('idle');
          return;
        }

        setState('transcribing');

        try {
          const formData = new FormData();
          formData.append('audio', blob, 'recording.webm');

          const res = await fetch('/api/ai/voice/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            throw new Error(`Transcription failed (${res.status})`);
          }

          const data = await res.json();
          resolveRef.current?.(data.text || '');
        } catch (error) {
          console.error('Transcription error:', error);
          resolveRef.current?.('');
        } finally {
          cleanup();
          setState('idle');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100); // Collect chunks every 100ms
      setState('recording');
    } catch (error) {
      console.error('Microphone access denied:', error);
      cleanup();
      setState('idle');
    }
  }, [isSupported, cleanup]);

  const stopRecording = useCallback(() => {
    return new Promise<string>((resolve) => {
      resolveRef.current = resolve;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      } else {
        resolve('');
        cleanup();
        setState('idle');
      }
    });
  }, [cleanup]);

  const cancelRecording = useCallback(() => {
    resolveRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    cleanup();
    setState('idle');
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    state,
    isSupported,
    startRecording,
    stopRecording,
    cancelRecording,
    audioLevel,
  };
}
