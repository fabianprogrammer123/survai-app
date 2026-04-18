'use client';

import { useState } from 'react';
import { ChevronDown, FileText, FolderOpen, LayoutGrid, List } from 'lucide-react';
import { SurveyCard } from './survey-card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { SurveyMeta } from '@/lib/survey/local-surveys';

interface SurveyGridProps {
  surveys: SurveyMeta[];
  searchQuery: string;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

type StatusFilter = 'all' | 'published' | 'drafts';

export function SurveyGrid({ surveys, searchQuery, onDuplicate, onDelete }: SurveyGridProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const searchFiltered = searchQuery
    ? surveys.filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : surveys;

  const filtered = searchFiltered.filter((s) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'published') return s.published;
    return !s.published;
  });

  return (
    <section>
      {searchFiltered.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-muted-foreground">Recent forms</h2>
          <div className="flex items-center gap-2">
            {/* Status filter */}
            <DropdownMenu>
              <DropdownMenuTrigger className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted/40 transition-colors outline-none">
                {statusFilter === 'all' ? 'Owned by anyone' : statusFilter === 'published' ? 'Published' : 'Drafts'}
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>Owned by anyone</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('published')}>Published</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('drafts')}>Drafts</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View toggle */}
            <div className="flex items-center rounded-md bg-muted/30 border border-border/30 p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={cn('p-1.5 rounded transition-colors', viewMode === 'grid' ? 'bg-background shadow-sm' : 'hover:bg-muted/40')}
                title="Grid view"
                data-view-mode="grid"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn('p-1.5 rounded transition-colors', viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-muted/40')}
                title="List view"
                data-view-mode="list"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Folder — disabled placeholder */}
            <button
              disabled
              className="p-1.5 rounded-md opacity-50 cursor-not-allowed"
              title="Folders coming soon"
            >
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 && surveys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
            <FileText className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-foreground/60 mb-1">No surveys yet</p>
          <p className="text-xs text-muted-foreground/60">Create your first survey using a template above</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">No surveys match your search</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-2">
          {filtered.map((survey) => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((survey) => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}
