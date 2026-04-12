import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardEditor } from '@/components/survey/dashboard/dashboard-editor';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: survey } = await supabase
    .from('surveys')
    .select('id, title, schema')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!survey) redirect('/dashboard');

  const { data: responses } = await supabase
    .from('responses')
    .select('id, answers, submitted_at')
    .eq('survey_id', id)
    .order('submitted_at', { ascending: false });

  return (
    <DashboardEditor
      survey={survey}
      responses={responses || []}
    />
  );
}
