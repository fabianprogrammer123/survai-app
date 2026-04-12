'use client';

import { Sparkles } from 'lucide-react';

interface ChatEmptyStateProps {
  // Kept for API compatibility with ChatPanel; no longer used but we
  // don't want to touch the caller in this task.
  onSuggestionClick?: (prompt: string) => void;
}

export function ChatEmptyState({}: ChatEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-5 py-10">
      <div className="relative mb-5">
        <div className="absolute inset-0 animate-pulse rounded-full bg-primary/15 blur-2xl scale-150" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/10">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-1.5">AI Assistant</h3>
      <p className="text-sm text-muted-foreground text-center max-w-[280px] leading-relaxed">
        Describe what you&apos;d like to build, or use the editor directly.
      </p>
    </div>
  );
}
