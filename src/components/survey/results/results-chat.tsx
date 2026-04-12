'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { Button } from '@/components/ui/button';
import { Send, Loader2, MessageSquare, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResultsChatProps {
  onSendMessage: (message: string) => Promise<void>;
}

export function ResultsChat({ onSendMessage }: ResultsChatProps) {
  const [input, setInput] = useState('');
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isLoading = useSurveyStore((s) => s.isResultsChatLoading);
  const messages = useSurveyStore((s) => s.resultsChatMessages);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 80)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  async function handleSubmit() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await onSendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const suggestions = [
    'Show satisfaction breakdown',
    'Compare response distributions',
    'What are the main themes?',
    'Show completion trends',
  ];

  return (
    <div className="border-t bg-background">
      {/* Chat history (collapsible) */}
      {messages.length > 0 && (
        <div>
          <button
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <MessageSquare className="h-3 w-3" />
            {messages.length} message{messages.length !== 1 ? 's' : ''}
            {historyExpanded ? <ChevronDown className="h-3 w-3 ml-auto" /> : <ChevronUp className="h-3 w-3 ml-auto" />}
          </button>
          {historyExpanded && (
            <div className="max-h-[200px] overflow-y-auto px-4 pb-2 space-y-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'text-xs rounded-lg px-3 py-2',
                    msg.role === 'user'
                      ? 'bg-primary/10 text-primary ml-8'
                      : 'bg-muted/50 text-muted-foreground mr-8'
                  )}
                >
                  {msg.content}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Suggestion chips */}
      {messages.length === 0 && (
        <div className="flex gap-1.5 px-4 pt-2 pb-1 overflow-x-auto">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onSendMessage(s)}
              disabled={isLoading}
              className="shrink-0 rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="p-3 flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your survey results..."
            disabled={isLoading}
            rows={1}
            className={cn(
              'w-full resize-none rounded-xl border bg-muted/30 px-3.5 py-2 text-sm leading-relaxed',
              'placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30',
              'disabled:opacity-50 transition-all',
              'min-h-[36px] max-h-[80px]'
            )}
          />
        </div>
        <Button
          size="icon"
          className="h-9 w-9 rounded-xl shrink-0"
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
