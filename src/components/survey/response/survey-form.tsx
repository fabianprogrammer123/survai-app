'use client';

import { useMemo, useState } from 'react';
import { SurveyElement } from '@/types/survey';
import { ElementRenderer } from '@/components/survey/elements/element-renderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

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

/**
 * Split the element list into pages on every page_break element. The
 * page_break element itself is a control marker, not a rendered
 * question, so it is excluded from each page's element list. An empty
 * trailing page (e.g. when the last element is a page_break) is
 * dropped so the user isn't shown a blank final page.
 */
function splitIntoPages(elements: SurveyElement[]): SurveyElement[][] {
  const pages: SurveyElement[][] = [[]];
  for (const el of elements) {
    if (el.type === 'page_break') {
      pages.push([]);
    } else {
      pages[pages.length - 1].push(el);
    }
  }
  // Drop trailing empty page (e.g. survey ends with a page_break)
  while (pages.length > 1 && pages[pages.length - 1].length === 0) {
    pages.pop();
  }
  // Always return at least one page — even if empty — so the form still
  // renders a submit button rather than crashing.
  return pages.length === 0 ? [[]] : pages;
}

export function SurveyForm({ survey, guestToken }: Props) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const elements = useMemo(() => survey.schema || [], [survey.schema]);
  const pages = useMemo(() => splitIntoPages(elements), [elements]);
  const totalPages = pages.length;
  // Clamp — if the element list changes mid-session we don't want a
  // stale currentPage to point past the end.
  const safePage = Math.min(currentPage, totalPages - 1);
  const pageElements = pages[safePage] ?? [];
  const isFirstPage = safePage === 0;
  const isLastPage = safePage === totalPages - 1;

  const handleChange = (elementId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [elementId]: value }));
  };

  /**
   * Validate the required questions in the CURRENT page before letting
   * the respondent advance. This matches the implicit page-boundary
   * contract — you can't silently skip a required question by
   * jumping past the page break.
   */
  function validateCurrentPage(): boolean {
    const missing = pageElements.filter(
      (el) =>
        el.required &&
        el.type !== 'section_header' &&
        el.type !== 'page_break' &&
        !answers[el.id]
    );
    if (missing.length > 0) {
      setError(`Please answer all required questions (${missing.length} remaining)`);
      return false;
    }
    setError(null);
    return true;
  }

  function handleNext() {
    if (!validateCurrentPage()) return;
    setCurrentPage((p) => Math.min(p + 1, totalPages - 1));
  }

  function handlePrev() {
    setError(null);
    setCurrentPage((p) => Math.max(p - 1, 0));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLastPage) {
      handleNext();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Validate required fields across ALL pages on final submit —
    // covers the case where a respondent navigated back, cleared a
    // value, and jumped forward without re-answering.
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
          {totalPages > 1 && (
            <div
              className="text-xs text-muted-foreground mt-2"
              data-page-indicator="true"
            >
              Page {safePage + 1} of {totalPages}
            </div>
          )}
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {pageElements.map((element) => (
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

      <div className="mt-6 flex flex-wrap items-center gap-3 justify-between">
        <div>
          {!isFirstPage && (
            <Button
              type="button"
              variant="outline"
              onClick={handlePrev}
              className="min-h-11 px-4"
              data-page-prev="true"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!isLastPage && (
            <Button
              type="button"
              onClick={handleNext}
              className="min-h-11 px-6"
              data-page-next="true"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {isLastPage && (
            <Button
              type="submit"
              className="min-h-11 px-6"
              disabled={isSubmitting}
              data-page-submit="true"
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
          )}
        </div>
      </div>
    </form>
  );
}
