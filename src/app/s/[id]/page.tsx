import { createClient } from '@/lib/supabase/server';
import { AnonymousSurvey } from '@/components/survey/response/anonymous-survey';
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

  // Pre-invited guest — personalized voice-first flow.
  if (token) {
    return <GuestSurvey surveyId={id} token={token} survey={survey} />;
  }

  // Anonymous public link — voice-or-typing landing. The component itself
  // falls back to the plain SurveyForm for respondents who pick typing or
  // for surveys without a published voice agent.
  return <AnonymousSurvey survey={survey} />;
}
