'use client';

import { useState, useRef, useEffect } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { ChatMessage } from '@/types/survey';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Sparkles, MessageSquare } from 'lucide-react';
import { nanoid } from 'nanoid';
import { cn } from '@/lib/utils';
import { AiResponse } from '@/lib/ai/schema';

interface Props {
  className?: string;
}

const SUGGESTIONS = [
  'Create a customer feedback survey',
  'Build an employee satisfaction form',
  'Make a product research questionnaire',
  'Design an event registration form',
];

export function ChatPanel({ className }: Props) {
  const [input, setInput] = useState('');
  const chatMessages = useSurveyStore((s) => s.chatMessages);
  const isChatLoading = useSurveyStore((s) => s.isChatLoading);
  const addChatMessage = useSurveyStore((s) => s.addChatMessage);
  const setChatLoading = useSurveyStore((s) => s.setChatLoading);
  const survey = useSurveyStore((s) => s.survey);
  const setSurvey = useSurveyStore((s) => s.setSurvey);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  async function handleSend(messageText?: string) {
    const text = messageText || input.trim();
    if (!text || isChatLoading) return;

    const userMessage: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    addChatMessage(userMessage);
    setInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId: survey.id,
          message: text,
          history: chatMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to get AI response');
      }

      const data: AiResponse = await res.json();

      const assistantMessage: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
      };

      addChatMessage(assistantMessage);

      // Update survey state with AI response
      setSurvey({
        ...survey,
        title: data.survey.title,
        description: data.survey.description,
        elements: data.survey.elements as any,
        settings: data.survey.settings,
      });
    } catch (error) {
      console.error('Chat error:', error);
      addChatMessage({
        id: nanoid(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className={cn('flex flex-col bg-background', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">AI Assistant</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Describe your survey and I'll build it for you
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MessageSquare className="h-8 w-8" />
            </div>
            <p className="text-sm text-muted-foreground">
              Tell me what kind of survey you'd like to create. I'll generate the questions and structure for you.
            </p>
            <div className="space-y-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSend(suggestion)}
                  className="block w-full text-left text-sm px-3 py-2 rounded-md border hover:bg-muted transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isChatLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your survey..."
            disabled={isChatLoading}
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isChatLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
