'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { SurveyElement } from '@/types/survey';
import { BarChart, PieChart, Histogram, StatCard } from './chart-components';

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

const CHART_COLORS = [
  'hsl(221, 83%, 53%)',
  'hsl(262, 83%, 58%)',
  'hsl(330, 81%, 60%)',
  'hsl(24, 94%, 50%)',
  'hsl(142, 71%, 45%)',
  'hsl(47, 95%, 53%)',
  'hsl(199, 89%, 48%)',
  'hsl(280, 67%, 50%)',
];

function getQuestionAnalysis(
  element: SurveyElement,
  responses: Response[]
) {
  const answers = responses
    .map((r) => r.answers[element.id])
    .filter((a) => a !== undefined && a !== null && a !== '');

  const totalResponses = responses.length;
  const answerRate = totalResponses > 0
    ? Math.round((answers.length / totalResponses) * 100)
    : 0;

  return { answers, answerRate, totalResponses };
}

function ChoiceBreakdown({
  element,
  responses,
}: {
  element: SurveyElement;
  responses: Response[];
}) {
  const { answers } = getQuestionAnalysis(element, responses);
  const options = 'options' in element ? element.options : [];

  // Count occurrences
  const counts: Record<string, number> = {};
  for (const opt of options) {
    counts[opt] = 0;
  }

  for (const answer of answers) {
    if (Array.isArray(answer)) {
      // Checkboxes
      for (const val of answer) {
        if (typeof val === 'string') {
          counts[val] = (counts[val] || 0) + 1;
        }
      }
    } else if (typeof answer === 'string') {
      counts[answer] = (counts[answer] || 0) + 1;
    }
  }

  const barData = Object.entries(counts).map(([label, value]) => ({
    label,
    value,
  }));

  const pieData = barData.map((item, i) => ({
    ...item,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="space-y-4">
      <BarChart data={barData} />
      {barData.length <= 8 && <PieChart data={pieData} />}
    </div>
  );
}

function ScaleBreakdown({
  element,
  responses,
}: {
  element: SurveyElement & { min: number; max: number };
  responses: Response[];
}) {
  const { answers } = getQuestionAnalysis(element, responses);
  const numericAnswers = answers
    .map((a) => (typeof a === 'number' ? a : parseFloat(String(a))))
    .filter((n) => !isNaN(n));

  if (numericAnswers.length === 0) {
    return <p className="text-sm text-muted-foreground">No responses yet</p>;
  }

  const avg = numericAnswers.reduce((sum, n) => sum + n, 0) / numericAnswers.length;
  const sorted = [...numericAnswers].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Distribution histogram
  const distribution: Record<number, number> = {};
  for (let i = element.min; i <= element.max; i++) {
    distribution[i] = 0;
  }
  for (const val of numericAnswers) {
    distribution[val] = (distribution[val] || 0) + 1;
  }

  const histData = Object.entries(distribution).map(([label, value]) => ({
    label,
    value,
  }));

  return (
    <div className="space-y-4">
      <div className="flex gap-6">
        <div>
          <p className="text-xs text-muted-foreground">Average</p>
          <p className="text-lg font-semibold">{avg.toFixed(1)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Median</p>
          <p className="text-lg font-semibold">{median}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Responses</p>
          <p className="text-lg font-semibold">{numericAnswers.length}</p>
        </div>
      </div>
      <Histogram data={histData} />
    </div>
  );
}

function TextResponses({
  element,
  responses,
}: {
  element: SurveyElement;
  responses: Response[];
}) {
  const { answers } = getQuestionAnalysis(element, responses);
  const textAnswers = answers.map(String).filter(Boolean);

  if (textAnswers.length === 0) {
    return <p className="text-sm text-muted-foreground">No responses yet</p>;
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {textAnswers.map((text, i) => (
        <div
          key={i}
          className="text-sm p-2 bg-muted rounded-md"
        >
          {text}
        </div>
      ))}
    </div>
  );
}

export function DashboardEditor({ survey, responses }: Props) {
  const elements = survey.schema || [];
  const questionElements = elements.filter(
    (el) => el.type !== 'section_header' && el.type !== 'page_break'
  );

  const answeredCount = responses.filter(
    (r) => Object.keys(r.answers).length > 0
  ).length;
  const completionRate =
    responses.length > 0
      ? Math.round((answeredCount / responses.length) * 100)
      : 0;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/survey/${survey.id}/edit`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{survey.title}</h1>
          <p className="text-muted-foreground text-sm">Response Dashboard</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Responses" value={responses.length} />
        <StatCard label="Questions" value={questionElements.length} />
        <StatCard label="Completion Rate" value={`${completionRate}%`} />
        <StatCard
          label="Latest Response"
          value={
            responses.length > 0
              ? new Date(responses[0].submitted_at).toLocaleDateString()
              : 'N/A'
          }
        />
      </div>

      {/* Per-question breakdowns */}
      {responses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-lg font-semibold mb-1">No responses yet</p>
            <p className="text-sm text-muted-foreground">
              Share your survey to start collecting responses
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {questionElements.map((element) => {
            const { answerRate } = getQuestionAnalysis(element, responses);

            return (
              <Card key={element.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{element.title}</CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {answerRate}% answered
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {(element.type === 'multiple_choice' ||
                    element.type === 'checkboxes' ||
                    element.type === 'dropdown') && (
                    <ChoiceBreakdown element={element} responses={responses} />
                  )}
                  {element.type === 'linear_scale' && (
                    <ScaleBreakdown
                      element={element as SurveyElement & { min: number; max: number }}
                      responses={responses}
                    />
                  )}
                  {(element.type === 'short_text' ||
                    element.type === 'long_text') && (
                    <TextResponses element={element} responses={responses} />
                  )}
                  {element.type === 'date' && (
                    <TextResponses element={element} responses={responses} />
                  )}
                  {element.type === 'file_upload' && (
                    <p className="text-sm text-muted-foreground">
                      File upload responses
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
