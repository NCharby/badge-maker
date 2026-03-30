'use server'

import { createAdminClient } from '@/lib/supabase/server'

export async function registerDevUser(fields: {
  email: string
  password: string
  dob: string
  telegramHandle: string | null
  sceneName: string | null
}) {
  if (!process.env.DEBUG_REGISTRATION_KEY || process.env.DEBUG_REGISTRATION_KEY !== 'enabled') {
    return { error: 'Dev registration path is not available.' }
  }

  const admin = createAdminClient()

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: fields.email,
    password: fields.password,
    email_confirm: true,
    user_metadata: {
      date_of_birth: fields.dob,
      telegram_handle: fields.telegramHandle,
      preferred_scene_name: fields.sceneName,
    },
  })
  if (authError) return { error: `Account creation failed: ${authError.message}` }
  if (!authData?.user?.id) return { error: 'Account creation failed: no user ID returned.' }

  const { error: profileError } = await admin.from('platform_users').upsert({
    id: authData.user.id,
    email: fields.email,
    date_of_birth: fields.dob,
    telegram_handle: fields.telegramHandle,
    preferred_scene_name: fields.sceneName,
    role: 'user',
  }, { onConflict: 'id', ignoreDuplicates: false })
  if (profileError) return { error: `Profile setup failed: ${profileError.message}` }

  return { success: true as const }
}
