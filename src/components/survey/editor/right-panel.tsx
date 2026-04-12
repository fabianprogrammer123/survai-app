'use client';

import { useState, useEffect } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { ChatPanel } from '@/components/survey/chat/chat-panel';
import { PropertiesPanel } from '@/components/survey/editor/properties-panel';
import { cn } from '@/lib/utils';

interface RightPanelProps {
  className?: string;
  aiEndpoint?: string;
  aiStreamEndpoint?: string;
}

export function RightPanel({ className, aiEndpoint, aiStreamEndpoint }: RightPanelProps) {
  const selectedId = useSurveyStore((s) => s.selectedElementId);
  const selectionSource = useSurveyStore((s) => s.selectionSource);
  const [activeTab, setActiveTab] = useState<'chat' | 'properties'>('chat');

  // Auto-switch to properties only when user clicks an element on the canvas
  useEffect(() => {
    if (selectedId && selectionSource === 'canvas') setActiveTab('properties');
  }, [selectedId, selectionSource]);

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Tab toggle */}
      <div className="px-4 pt-3.5 pb-2.5 shrink-0">
        <div className="flex items-center bg-muted/80 rounded-xl p-1 gap-0.5 w-full">
          <button
            onClick={() => setActiveTab('chat')}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
              activeTab === 'chat'
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab('properties')}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
              activeTab === 'properties'
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
          >
            Properties
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'chat' ? (
        <ChatPanel aiEndpoint={aiEndpoint} aiStreamEndpoint={aiStreamEndpoint} className="flex-1 overflow-hidden" />
      ) : (
        <PropertiesPanel className="flex-1 overflow-hidden" />
      )}
    </div>
  );
}
