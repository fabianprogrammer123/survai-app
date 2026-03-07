import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { SurveyEditor } from '@/components/survey/editor/survey-editor';
import { Survey, DEFAULT_SETTINGS, SurveyElement } from '@/types/survey';

export default async function EditSurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: surveyData } = await supabase
    .from('surveys')
    .select('*')
    .eq('id', id)
    .single();

  if (!surveyData) redirect('/dashboard');

  // Map database row to Survey type
  const survey: Survey = {
    id: surveyData.id,
    title: surveyData.title,
    description: surveyData.description || '',
    elements: (surveyData.schema as SurveyElement[]) || [],
    settings: (surveyData.settings as typeof DEFAULT_SETTINGS) || DEFAULT_SETTINGS,
    published: surveyData.published,
    createdAt: surveyData.created_at,
    updatedAt: surveyData.updated_at,
  };

  return <SurveyEditor initialSurvey={survey} />;
}
