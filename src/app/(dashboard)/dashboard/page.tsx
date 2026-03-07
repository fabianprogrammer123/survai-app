import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardContent } from '@/components/dashboard/dashboard-content';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: surveys } = await supabase
    .from('surveys')
    .select('*, responses(count)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  return <DashboardContent surveys={surveys || []} />;
}
