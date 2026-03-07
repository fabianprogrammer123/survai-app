import { createClient } from '@/lib/supabase/server';
import { SurveyForm } from '@/components/survey/response/survey-form';
import { notFound } from 'next/navigation';

export default async function PublicSurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-2xl">
        <SurveyForm survey={survey} />
      </div>
    </div>
  );
}
