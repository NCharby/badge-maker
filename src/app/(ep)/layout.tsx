import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EpNav from '@/components/nav/EpNav'

export default async function EpLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: platformUser } = await supabase
    .from('platform_users')
    .select('preferred_scene_name, email, role')
    .eq('id', user.id)
    .single()

  if (platformUser?.role !== 'event_promoter' && platformUser?.role !== 'system_admin') {
    redirect('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sd-bg)' }}>
      <EpNav user={platformUser} />
      <main>{children}</main>
    </div>
  )
}
