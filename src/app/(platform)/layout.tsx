import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppNav from '@/components/nav/AppNav'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
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

  const { count: unreadCount } = await supabase
    .from('platform_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)
    .is('dismissed_at', null)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sd-bg)' }}>
      <AppNav user={platformUser} unreadCount={unreadCount ?? 0} />
      <main>{children}</main>
    </div>
  )
}
