'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { SurveyElement } from '@/types/survey';

interface Response {
  id: string;
  answers: Record<string, unknown>;
  submitted_at: string;
}

interface SurveyData {
  id: string;
  title: string;
  schema: SurveyElement[];
}

interface Props {
  survey: SurveyData;
  responses: Response[];
}

export function ResponsesViewer({ survey, responses }: Props) {
  const elements = survey.schema || [];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/survey/${survey.id}/edit`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{survey.title}</h1>
          <p className="text-muted-foreground text-sm">
            {responses.length} response{responses.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {responses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-1">No responses yet</h2>
            <p className="text-sm text-muted-foreground">
              Share your survey to start collecting responses
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {responses.map((response, i) => (
            <Card key={response.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    Response #{responses.length - i}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {new Date(response.submitted_at).toLocaleDateString()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {elements
                    .filter((el) => el.type !== 'section_header' && el.type !== 'page_break')
                    .map((element) => {
                      const answer = response.answers[element.id];
                      return (
                        <div key={element.id}>
                          <p className="text-sm font-medium text-muted-foreground">
                            {element.title}
                          </p>
                          <p className="text-sm mt-0.5">
                            {answer !== undefined && answer !== null
                              ? Array.isArray(answer)
                                ? (answer as string[]).join(', ')
                                : String(answer)
                              : '—'}
                          </p>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
