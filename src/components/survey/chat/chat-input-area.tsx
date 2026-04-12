'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputAreaProps {
  onSend: (text: string, inputMethod: 'text' | 'voice') => void;
  isLoading: boolean;
  chatMode?: 'text' | 'dictation';
  voiceButton?: React.ReactNode;
}

export function ChatInputArea({ onSend, isLoading, voiceButton }: ChatInputAreaProps) {
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
        {voiceButton}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your survey..."
            disabled={isLoading}
            rows={1}
            className={cn(
              'w-full resize-none rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm leading-relaxed',
              'placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30',
              'disabled:opacity-50 transition-all',
              'min-h-[44px] max-h-[120px]',
              'overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
            )}
          />
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
