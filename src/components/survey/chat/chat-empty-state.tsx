'use client';

import { Sparkles, Users, Building2, Star, CalendarDays } from 'lucide-react';

const SUGGESTIONS = [
  {
    icon: Users,
    title: 'Customer Satisfaction',
    prompt: 'Create a customer satisfaction survey',
    description: 'Measure happiness across touchpoints',
  },
  {
    icon: Building2,
    title: 'Employee Engagement',
    prompt: 'Build an employee engagement form',
    description: 'Assess team morale and culture',
  },
  {
    icon: Star,
    title: 'Product Feedback',
    prompt: 'Create a product feedback survey',
    description: 'Gather insights on your product',
  },
  {
    icon: CalendarDays,
    title: 'Event Feedback',
    prompt: 'Build an event feedback form',
    description: 'Collect feedback after events',
  },
];

interface ChatEmptyStateProps {
  onSuggestionClick: (prompt: string) => void;
}

export function ChatEmptyState({ onSuggestionClick }: ChatEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-5 py-10">
      <div className="relative mb-5">
        <div className="absolute inset-0 animate-pulse rounded-full bg-primary/15 blur-2xl scale-150" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/10">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-1.5">AI Assistant</h3>
      <p className="text-sm text-muted-foreground text-center mb-8 max-w-[280px] leading-relaxed">
        Describe what you&apos;d like to build, or use the editor directly
      </p>

      <div className="grid grid-cols-2 gap-2.5 w-full">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            onClick={() => onSuggestionClick(s.prompt)}
            className="group flex flex-col items-start gap-2 rounded-xl border border-border/50 bg-card p-4 text-left transition-all duration-200 hover:border-primary/30 hover:bg-accent/40 hover:shadow-md hover:-translate-y-[1px]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/80 group-hover:bg-primary/10 transition-colors">
              <s.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="text-sm font-medium leading-tight">{s.title}</span>
            <span className="text-xs text-muted-foreground leading-snug">
              {s.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
