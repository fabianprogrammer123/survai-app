import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ResponsesViewer } from '@/components/survey/response/responses-viewer';

export default async function ResponsesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: survey } = await supabase
    .from('surveys')
    .select('*')
    .eq('id', id)
    .single();

  if (!survey) redirect('/dashboard');

  const { data: responses } = await supabase
    .from('responses')
    .select('*')
    .eq('survey_id', id)
    .order('submitted_at', { ascending: false });

  return (
    <div className="min-h-screen bg-background">
      <ResponsesViewer survey={survey} responses={responses || []} />
    </div>
  );
}
