import { createClient } from '@/lib/supabase/server';
import { SurveyForm } from '@/components/survey/response/survey-form';
import { GuestSurvey } from '@/components/survey/response/guest-survey';
import { notFound } from 'next/navigation';

export default async function PublicSurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t: token } = await searchParams;
  const supabase = await createClient();

  const { data: survey } = await supabase
    .from('surveys')
    .select('*')
    .eq('id', id)
    .eq('published', true)
    .single();

  if (!survey) {
    notFound();
  }

  // If there's an invite token, render the personalized voice-first experience
  if (token) {
    return <GuestSurvey surveyId={id} token={token} survey={survey} />;
  }

  // Default: standard form for anonymous respondents
  return (
    <div className="min-h-screen bg-muted/30 py-6 sm:py-8 px-3 sm:px-4">
      <div className="mx-auto max-w-2xl">
        <SurveyForm survey={survey} />
      </div>
    </div>
  );
}
