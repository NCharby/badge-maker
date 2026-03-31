import { createClient, createAdminClient } from '@/lib/supabase/server'
import NewEventClient from './NewEventClient'

export default async function NewEventPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let venues: { id: string; name: string }[] = []
  if (user) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('venues')
      .select('id, name')
      .eq('owner_id', user.id)
      .order('name')
    venues = data ?? []
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <NewEventClient venues={venues} />
    </div>
  )
}
