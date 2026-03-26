import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/nav/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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

  if (platformUser?.role !== 'system_admin') {
    redirect('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sd-bg)' }}>
      <AdminNav user={platformUser} />
      <main>{children}</main>
    </div>
  )
}
