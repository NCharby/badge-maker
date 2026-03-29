'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ProfileUpdateData = {
  preferred_scene_name: string
  other_scene_names: string[]
  phone: string
  address: string
  zip_code: string
  social_media: { key: string; value: string }[]
  telegram_handle: string
  roommate_finder_hidden: boolean
  email_notifications_enabled: boolean
  telegram_notifications_enabled: boolean
}

export async function updateProfile(data: ProfileUpdateData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const cleanHandle = data.telegram_handle.replace(/^@/, '').trim()
  const cleanSocials = data.social_media.filter(s => s.key.trim() && s.value.trim())

  const { error } = await supabase
    .from('platform_users')
    .update({
      preferred_scene_name: data.preferred_scene_name.trim() || null,
      other_scene_names: data.other_scene_names.length ? data.other_scene_names : null,
      phone: data.phone.trim() || null,
      address: data.address.trim() || null,
      zip_code: data.zip_code.trim() || null,
      social_media: cleanSocials.length ? cleanSocials : null,
      telegram_handle: cleanHandle || null,
      roommate_finder_hidden: data.roommate_finder_hidden,
      email_notifications_enabled: data.email_notifications_enabled,
      telegram_notifications_enabled: data.telegram_notifications_enabled,
    })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/profile')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updatePaymentProvider(provider: 'square' | 'paypal') {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: platformUser } = await supabase
    .from('platform_users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!platformUser || !['event_promoter', 'system_admin'].includes(platformUser.role)) {
    return { error: 'Access denied.' }
  }

  const { error } = await supabase
    .from('platform_users')
    .update({ payment_provider: provider })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/profile')
  return { success: true }
}

export async function requestEmailChange(newEmail: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ email: newEmail })
  if (error) return { error: error.message }
  return { success: true }
}
