'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { useAiChat } from '@/hooks/use-ai-chat';
import { useVoiceInput } from '@/hooks/use-voice-input';
import { useVoiceOutput } from '@/hooks/use-voice-output';
import { ChatHeader } from './chat-header';
import { ChatEmptyState } from './chat-empty-state';
import { ChatMessage } from './chat-message';
import { ChatInputArea } from './chat-input-area';
import { VoiceInputButton } from './voice-input-button';
import { VoiceModeOverlay } from './voice-mode-overlay';
import { cn } from '@/lib/utils';
import { nanoid } from 'nanoid';
import type { GenerationBatch, Proposal, SurveyElement } from '@/types/survey';

interface Props {
  className?: string;
  aiEndpoint?: string;
  aiStreamEndpoint?: string;
}

export function ChatPanel({ className, aiEndpoint, aiStreamEndpoint }: Props) {
  const chatMessages = useSurveyStore((s) => s.chatMessages);
  const isChatLoading = useSurveyStore((s) => s.isChatLoading);
  const generationBatches = useSurveyStore((s) => s.generationBatches);
  const chatMode = useSurveyStore((s) => s.chatMode);
  const voiceEnabled = useSurveyStore((s) => s.voiceEnabled);

  const { sendMessage, statusText } = useAiChat({
    endpoint: aiEndpoint || '/api/ai/chat/test',
    streamEndpoint: aiStreamEndpoint,
  });
  const voice = useVoiceInput();
  const tts = useVoiceOutput();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Auto-play TTS for new assistant messages in text+dictation modes
  const lastMsgRef = useRef<string | null>(null);
  useEffect(() => {
    // Voice mode handles its own TTS via VoiceModeOverlay
    if (chatMode === 'voice') return;
    if (!voiceEnabled || chatMessages.length === 0) return;
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (lastMsg.role === 'assistant' && lastMsg.id !== lastMsgRef.current) {
      lastMsgRef.current = lastMsg.id;
      tts.speak(lastMsg.content);
    }
  }, [chatMessages, voiceEnabled, chatMode, tts]);

  const handleSend = useCallback(
    (text: string, inputMethod: 'text' | 'voice' = 'text') => {
      if (!text.trim() || isChatLoading) return;
      tts.stop();
      sendMessage(text, inputMethod);
    },
    [sendMessage, isChatLoading, tts]
  );

  // Dictation: stop recording → transcribe → send
  const handleVoiceStop = useCallback(async () => {
    const transcription = await voice.stopRecording();
    if (transcription.trim()) {
      handleSend(transcription, 'voice');
    }
  }, [voice, handleSend]);

  // Apply a selected proposal with streaming animation
  const handleProposalSelect = useCallback(async (proposal: Proposal) => {
    const store = useSurveyStore.getState();

    store.addChatMessage({
      id: nanoid(),
      role: 'user',
      content: `I'll go with "${proposal.label}"`,
      timestamp: new Date().toISOString(),
    });

    store.replaceElements([]);
    store.updateSettings(proposal.settings);
    store.setBlockMap(proposal.blockMap || {});
    store.setStreaming(true);

    for (const element of proposal.elements) {
      await new Promise((r) => setTimeout(r, 150));
      store.addElement(element);
      store.addRecentlyAdded(element.id);
    }

    store.setStreaming(false);
    setTimeout(() => {
      useSurveyStore.getState().clearRecentlyAdded();
    }, 1000);

    store.addChatMessage({
      id: nanoid(),
      role: 'assistant',
      content: `Applied "${proposal.label}" to your survey. You can now customize each question by clicking on it.`,
      timestamp: new Date().toISOString(),
    });
  }, []);

  function getBatchForMessage(messageId: string): GenerationBatch | undefined {
    return generationBatches.find((b) => b.messageId === messageId);
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {chatMessages.length === 0 ? (
          <ChatEmptyState onSuggestionClick={(prompt) => handleSend(prompt, 'text')} />
        ) : (
          <div className="p-4 space-y-3">
            {chatMessages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                batch={
                  msg.generationBatchId
                    ? getBatchForMessage(msg.id)
                    : undefined
                }
                onSuggestionClick={(text) => handleSend(text, 'text')}
                onProposalSelect={handleProposalSelect}
              />
            ))}

            {/* Typing indicator with streaming status */}
            {isChatLoading && (
              <div className="flex justify-start animate-in fade-in-0 duration-200">
                <div className="bg-muted/60 border rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                  {statusText && (
                    <span className="text-xs text-muted-foreground ml-1">{statusText}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area — always text mode with mic button */}
      <ChatInputArea
        onSend={handleSend}
        isLoading={isChatLoading}
        voiceButton={
          <VoiceInputButton
            state={voice.state}
            isSupported={voice.isSupported}
            audioLevel={voice.audioLevel}
            onStart={voice.startRecording}
            onStop={handleVoiceStop}
          />
        }
      />
    </div>
  );
}
