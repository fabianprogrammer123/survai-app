'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreVertical, FileText, BarChart3, Trash2, ExternalLink, Loader2, PieChart } from 'lucide-react';
import Link from 'next/link';

interface SurveyItem {
  id: string;
  title: string;
  description: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  responses: { count: number }[];
}

interface Props {
  surveys: SurveyItem[];
}

export function DashboardContent({ surveys }: Props) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setError(err?.error || 'Failed to create survey. Please try again.');
        setCreating(false);
        return;
      }
      const survey = await res.json();
      router.push(`/survey/${survey.id}/edit`);
    } catch (e) {
      console.error('[dashboard] create failed:', e);
      setError('Failed to create survey. Please try again.');
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    await supabase.from('surveys').delete().eq('id', id);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Surveys</h1>
            <p className="text-muted-foreground mt-1">Create and manage your surveys</p>
          </div>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            New Survey
          </Button>
        </div>
        {error && (
          <p className="text-sm text-red-500 mb-4">{error}</p>
        )}

        {surveys.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-1">No surveys yet</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first AI-powered survey
              </p>
              <Button onClick={handleCreate} disabled={creating}>
                <Plus className="mr-2 h-4 w-4" /> New Survey
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {surveys.map((survey) => {
              const responseCount = survey.responses?.[0]?.count || 0;
              return (
                <Card key={survey.id} className="group hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">
                          <Link href={`/survey/${survey.id}/edit`} className="hover:underline">
                            {survey.title}
                          </Link>
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          Updated {new Date(survey.updated_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/survey/${survey.id}/edit`)}>
                            <FileText className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/survey/${survey.id}/responses`)}>
                            <BarChart3 className="mr-2 h-4 w-4" /> Responses
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/survey/${survey.id}/dashboard`)}>
                            <PieChart className="mr-2 h-4 w-4" /> Dashboard
                          </DropdownMenuItem>
                          {survey.published && (
                            <DropdownMenuItem onClick={() => window.open(`/s/${survey.id}`, '_blank')}>
                              <ExternalLink className="mr-2 h-4 w-4" /> View
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleDelete(survey.id, survey.title)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {survey.published ? (
                        <Badge variant="default" className="text-xs">Published</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Draft</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {responseCount} response{responseCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
