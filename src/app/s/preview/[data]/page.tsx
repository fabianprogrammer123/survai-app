import { SurveyForm } from '@/components/survey/response/survey-form';
import type { Survey } from '@/types/survey';
import { notFound } from 'next/navigation';

/**
 * URL-encoded preview route. The survey is base64url-encoded into the
 * [data] path segment, decoded server-side, and rendered via SurveyForm.
 *
 * This is a demo-grade share link — responses are NOT persisted because
 * there is no backend table to write to. The creator cannot see what
 * respondents submitted. Real publish + response collection is Plan D.
 */
export default async function PreviewSurveyPage({
  params,
}: {
  params: Promise<{ data: string }>;
}) {
  const { data } = await params;

  let survey: Survey | null = null;
  try {
    // base64url → utf8 → JSON
    const json = Buffer.from(data, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as unknown;
    // Minimal shape check — we trust the creator but defend against garbage URLs
    if (
      parsed &&
      typeof parsed === 'object' &&
      'title' in parsed &&
      'elements' in parsed &&
      Array.isArray((parsed as Survey).elements)
    ) {
      survey = parsed as Survey;
    }
  } catch {
    survey = null;
  }

  if (!survey) {
    notFound();
  }

  // SurveyForm consumes the Supabase row shape ({id,title,description,schema,settings})
  // where `schema` is the elements array. The store-side Survey type uses
  // `elements`, so we adapt it here.
  const surveyForForm = {
    id: survey.id || 'preview',
    title: survey.title || 'Untitled Survey',
    description: survey.description || '',
    schema: survey.elements,
    settings: {
      theme: survey.settings?.theme || 'default',
      showProgressBar: survey.settings?.showProgressBar ?? true,
      confirmationMessage:
        survey.settings?.confirmationMessage || 'Thank you for your response!',
    },
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-2xl">
        <div
          className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-400"
          data-preview-notice="true"
        >
          Preview link — this is a shareable demo. Responses are not saved to a database yet.
        </div>
        <SurveyForm survey={surveyForForm} />
      </div>
    </div>
  );
}
