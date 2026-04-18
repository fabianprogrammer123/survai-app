'use client';

import {
  forwardRef,
  useState,
  useRef,
  useCallback,
  useEffect,
  useImperativeHandle,
} from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputAreaProps {
  onSend: (text: string, inputMethod: 'text' | 'voice') => void;
  isLoading: boolean;
  chatMode?: 'text' | 'dictation';
  voiceButton?: React.ReactNode;
  /** Shown inside the textarea while transcription is running. */
  transcribing?: boolean;
}

export interface ChatInputAreaHandle {
  /**
   * Insert text into the textarea at the cursor (or append to end).
   * Used by voice input so transcription lands in the box for review
   * rather than auto-sending as a message.
   */
  insertText: (text: string) => void;
  focus: () => void;
}

export const ChatInputArea = forwardRef<ChatInputAreaHandle, ChatInputAreaProps>(
  function ChatInputArea({ onSend, isLoading, voiceButton, transcribing }, ref) {
    const [input, setInput] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }, []);

    useEffect(() => {
      adjustHeight();
    }, [input, adjustHeight]);

    useImperativeHandle(
      ref,
      () => ({
        insertText(text) {
          const clean = text.trim();
          if (!clean) return;
          const textarea = textareaRef.current;

          setInput((prev) => {
            if (!textarea) return prev ? `${prev} ${clean}` : clean;

            // Insert at the current cursor position, preserving selection.
            const start = textarea.selectionStart ?? prev.length;
            const end = textarea.selectionEnd ?? prev.length;
            const needsLeadingSpace =
              start > 0 && prev[start - 1] && !/\s/.test(prev[start - 1]);
            const insert = (needsLeadingSpace ? ' ' : '') + clean;
            const next = prev.slice(0, start) + insert + prev.slice(end);

            // Move caret to the end of the inserted text on next frame.
            requestAnimationFrame(() => {
              const caret = start + insert.length;
              textarea.focus();
              try {
                textarea.setSelectionRange(caret, caret);
              } catch {
                // Some browsers refuse setSelectionRange on still-hidden inputs.
              }
            });

            return next;
          });
        },
        focus() {
          textareaRef.current?.focus();
        },
      }),
      []
    );

    function handleSubmit() {
      const text = input.trim();
      if (!text || isLoading) return;
      setInput('');
      onSend(text, 'text');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    }

    return (
      <div className="p-4 border-t border-border/60 shrink-0 bg-background">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={transcribing ? 'Transcribing…' : 'Describe your survey…'}
              disabled={isLoading}
              rows={1}
              className={cn(
                'w-full resize-none rounded-xl border border-border/50 bg-muted/20 pl-4 pr-12 py-3 text-sm leading-relaxed',
                'placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30',
                'disabled:opacity-50 transition-all',
                'min-h-[44px] max-h-[120px]',
                'overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
                transcribing && 'border-primary/40 bg-primary/5'
              )}
            />
            {voiceButton && (
              <div className="absolute right-1.5 bottom-1.5">{voiceButton}</div>
            )}
          </div>
          <Button
            size="icon"
            className="h-11 w-11 rounded-xl shrink-0 shadow-sm"
            disabled={!input.trim() || isLoading}
            onClick={handleSubmit}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    );
  }
);
