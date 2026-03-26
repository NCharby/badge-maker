import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileForm from './ProfileForm'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: platformUser } = await supabase
    .from('platform_users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!platformUser) redirect('/login')

  return <ProfileForm user={platformUser} />
}
