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

  // If the telegram handle changed, reset verification status
  const { data: current } = await supabase
    .from('platform_users')
    .select('telegram_handle, telegram_verified')
    .eq('id', user.id)
    .single()

  const handleChanged = cleanHandle !== (current?.telegram_handle ?? '')
  const resetVerification = handleChanged && current?.telegram_verified

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
      ...(resetVerification ? {
        telegram_verified: false,
        telegram_chat_id: null,
        telegram_verification_code: null,
        telegram_verification_expires_at: null,
      } : {}),
    })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/profile')
  revalidatePath('/dashboard')
  return { success: true }
}

// Generates a 6-digit verification code and stores it in the DB.
// Returns the code to the client — the user sends /verify CODE to the bot to complete verification.
// Verification is performed by the bot webhook, not by a client-side form submission.
export async function sendTelegramVerificationCode() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('platform_users')
    .select('telegram_handle, telegram_verified')
    .eq('id', user.id)
    .single()

  if (!profile?.telegram_handle) {
    return { error: 'Please save a Telegram handle first.' }
  }
  if (profile.telegram_verified) {
    return { error: 'Your Telegram handle is already verified.' }
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  const { error: updateError } = await supabase
    .from('platform_users')
    .update({
      telegram_verification_code: code,
      telegram_verification_expires_at: expiresAt,
    })
    .eq('id', user.id)

  if (updateError) return { error: updateError.message }

  return { success: true, code }
}

export async function updatePaymentProvider(provider: 'square' | 'paypal') {
  if (!['square', 'paypal'].includes(provider)) {
    return { error: 'Invalid payment provider.' }
  }

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
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'Not authenticated.' }
  const { error } = await supabase.auth.updateUser({ email: newEmail })
  if (error) return { error: error.message }
  return { success: true }
}
