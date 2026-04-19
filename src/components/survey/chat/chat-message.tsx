'use client';

import { useMemo } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { InsightCardGroup } from './insight-card-group';
import { ProposalCard } from './proposal-card';
import { Mic, HelpCircle, Info, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType, GenerationBatch, Proposal, ClarifyingQuestion } from '@/types/survey';

interface ChatMessageProps {
  message: ChatMessageType;
  batch?: GenerationBatch;
  onSuggestionClick?: (text: string) => void;
  onProposalSelect?: (proposal: Proposal) => void;
}

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Simple inline markdown: **bold**, *italic*, `code` */
function renderSimpleMarkdown(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function ChatMessage({ message, batch, onSuggestionClick, onProposalSelect }: ChatMessageProps) {
  const highlightedMessageId = useSurveyStore((s) => s.highlightedMessageId);
  const inspectorEnabled = useSurveyStore((s) => s.inspectorEnabled);
  const setInspectorTraceId = useSurveyStore((s) => s.setInspectorTraceId);
  const isHighlighted = highlightedMessageId === message.id;
  const isUser = message.role === 'user';

  const timeText = useMemo(() => formatRelativeTime(message.timestamp), [message.timestamp]);

  const hasClarifyingQuestions = !isUser && message.clarifyingQuestions && message.clarifyingQuestions.length > 0;
  const hasProposals = !isUser && message.proposals && message.proposals.length > 0;
  const showInspectorButton = !isUser && inspectorEnabled && Boolean(message.traceId);

  return (
    <div
      className={cn(
        'flex animate-in slide-in-from-bottom-2 fade-in-0 duration-300',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div className="max-w-[90%] space-y-1.5">
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed transition-all',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : message.isError
                ? 'bg-destructive/10 border border-destructive/30 text-destructive rounded-bl-md'
                : cn(
                    'bg-muted/60 border rounded-bl-md',
                    isHighlighted && 'border-primary/40 bg-primary/5 shadow-sm'
                  )
          )}
        >
          {isUser ? (
            <div className="flex items-start gap-2">
              <span>{message.content}</span>
              {message.inputMethod === 'voice' && (
                <Mic className="h-3 w-3 shrink-0 mt-0.5 opacity-60" />
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {message.content.split('\n').map((line, i) => (
                <p key={i}>{renderSimpleMarkdown(line)}</p>
              ))}
            </div>
          )}
        </div>

        {/* Retry button on shape-failure errors */}
        {!isUser && message.isError && message.retryText && (
          <div className="flex flex-wrap gap-1.5 px-1">
            <button
              onClick={() => onSuggestionClick?.(message.retryText!)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs',
                'bg-destructive/10 text-destructive border border-destructive/30',
                'hover:bg-destructive/20 hover:border-destructive/40 transition-colors',
                'cursor-pointer'
              )}
            >
              <RotateCw className="h-3 w-3 shrink-0" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Clarifying questions as clickable chips */}
        {hasClarifyingQuestions && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {message.clarifyingQuestions!.map((cq, i) => {
              const question = typeof cq === 'string' ? cq : cq.question;
              const responseText = typeof cq === 'string' ? cq : cq.response;
              return (
                <button
                  key={i}
                  onClick={() => onSuggestionClick?.(responseText)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs',
                    'bg-primary/10 text-primary border border-primary/20',
                    'hover:bg-primary/20 hover:border-primary/30 transition-colors',
                    'cursor-pointer'
                  )}
                >
                  <HelpCircle className="h-3 w-3 shrink-0" />
                  <span>{question}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Proposal cards */}
        {hasProposals && (
          <div className="space-y-2 px-1">
            {message.proposals!.map((proposal, i) => (
              <ProposalCard
                key={i}
                proposal={proposal}
                index={i}
                onSelect={(p) => onProposalSelect?.(p)}
              />
            ))}
          </div>
        )}

        {/* Insight cards for generation batches */}
        {batch && batch.insightCards.length > 0 && (
          <InsightCardGroup batch={batch} />
        )}

        <div className="flex items-center gap-1.5 px-1">
          <span className="text-[10px] text-muted-foreground/60">{timeText}</span>
          {showInspectorButton && (
            <button
              type="button"
              onClick={() => setInspectorTraceId(message.traceId ?? null)}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground hover:border-border"
              aria-label="Open AI Inspector for this message"
              title="Open AI Inspector"
            >
              <Info className="h-2.5 w-2.5" />
              inspect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
