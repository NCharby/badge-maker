import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: platformUser } = await supabase
    .from('platform_users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = platformUser?.role
  if (role === 'system_admin') redirect('/admin/dashboard')
  if (role === 'event_promoter') redirect('/ep/dashboard')
  redirect('/dashboard')
}
