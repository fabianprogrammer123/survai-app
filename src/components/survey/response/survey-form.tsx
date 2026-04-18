'use client';

import { useState } from 'react';
import { SurveyElement } from '@/types/survey';
import { ElementRenderer } from '@/components/survey/elements/element-renderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Loader2 } from 'lucide-react';

interface SurveyData {
  id: string;
  title: string;
  description: string;
  schema: SurveyElement[];
  settings: {
    theme: string;
    showProgressBar: boolean;
    confirmationMessage: string;
  };
}

interface Props {
  survey: SurveyData;
  guestToken?: string;
}

export function SurveyForm({ survey, guestToken }: Props) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elements = survey.schema || [];

  const handleChange = (elementId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [elementId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Validate required fields
    const missingRequired = elements.filter(
      (el) =>
        el.required &&
        el.type !== 'section_header' &&
        el.type !== 'page_break' &&
        !answers[el.id]
    );

    if (missingRequired.length > 0) {
      setError(`Please answer all required questions (${missingRequired.length} remaining)`);
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/surveys/${survey.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, guestToken }),
      });

      if (!res.ok) throw new Error('Failed to submit');
      setSubmitted(true);
    } catch {
      setError('Failed to submit response. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Response Submitted</h2>
          <p className="text-muted-foreground text-center">
            {survey.settings?.confirmationMessage || 'Thank you for your response!'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} data-survey-form-response="true">
      <Card className="mb-4 border-t-4 border-t-primary">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-xl sm:text-2xl break-words">{survey.title}</CardTitle>
          {survey.description && (
            <CardDescription className="break-words">{survey.description}</CardDescription>
          )}
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {elements.map((element) => (
          <Card key={element.id}>
            <CardContent className="pt-6 px-4 sm:px-6">
              <ElementRenderer
                element={element}
                mode="response"
                value={answers[element.id]}
                onChange={(value) => handleChange(element.id, value)}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="mt-6 flex justify-center sm:justify-start">
        <Button
          type="submit"
          className="w-full sm:w-auto min-h-11 px-6"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit'
          )}
        </Button>
      </div>
    </form>
  );
}
