'use client';

import { useSurveyStore } from '@/lib/survey/store';
import { Type, Mic, AudioWaveform } from 'lucide-react';
import { cn } from '@/lib/utils';

const modes = [
  { id: 'text' as const, label: 'Text', icon: Type },
  { id: 'dictation' as const, label: 'Dictation', icon: Mic },
  { id: 'voice' as const, label: 'Voice', icon: AudioWaveform },
] as const;

export function ChatHeader() {
  const chatMode = useSurveyStore((s) => s.chatMode);
  const setChatMode = useSurveyStore((s) => s.setChatMode);

  return (
    <div className="flex items-center justify-center px-4 py-2.5 shrink-0">
      <div className="flex gap-0.5 bg-muted/50 rounded-xl p-1">
        {modes.map((m) => {
          const Icon = m.icon;
          const active = chatMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setChatMode(m.id)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                active
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/40'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              )}
            >
              <Icon className="h-3 w-3" />
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
