'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function signalReadyToLock(eventId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('event_attendees')
    .update({ lock_status: 'Ready to Lock' })
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('lock_status', 'Unlocked')

  if (error) return { error: error.message }
  revalidatePath(`/events/${eventId}`)
  return { success: true }
}
