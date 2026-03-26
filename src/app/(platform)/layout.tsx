import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UserNav from '@/components/nav/UserNav'

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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sd-bg)' }}>
      <UserNav user={platformUser} />
      <main>{children}</main>
    </div>
  )
}
