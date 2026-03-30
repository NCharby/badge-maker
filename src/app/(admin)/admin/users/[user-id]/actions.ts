'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const, user: null, supabase: null }

  const { data: platformUser } = await supabase
    .from('platform_users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (platformUser?.role !== 'system_admin') {
    return { error: 'Access denied.' as const, user: null, supabase: null }
  }

  return { error: null, user, supabase }
}

export async function updateUserRole(
  targetUserId: string,
  newRole: 'user' | 'event_promoter'
) {
  const { error, user } = await getAdminUser()
  if (error || !user) return { error: error ?? 'Unauthorized' }

  if (targetUserId === user.id) {
    return { error: 'Cannot modify your own role.' }
  }

  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from('platform_users')
    .update({ role: newRole })
    .eq('id', targetUserId)

  if (updateError) return { error: updateError.message }
  revalidatePath(`/admin/users/${targetUserId}`)
  revalidatePath('/admin/users')
  return { success: true }
}

export async function adminUpdatePaymentProvider(
  targetUserId: string,
  provider: 'square' | 'paypal'
) {
  if (!['square', 'paypal'].includes(provider)) {
    return { error: 'Invalid payment provider.' }
  }

  const { error } = await getAdminUser()
  if (error) return { error }

  const admin = createAdminClient()
  const { data: target } = await admin
    .from('platform_users')
    .select('role')
    .eq('id', targetUserId)
    .single()

  if (!target || !['event_promoter', 'system_admin'].includes(target.role)) {
    return { error: 'Payment provider can only be set for Event Promoters and Admins.' }
  }

  const { error: updateError } = await admin
    .from('platform_users')
    .update({ payment_provider: provider })
    .eq('id', targetUserId)

  if (updateError) return { error: updateError.message }
  revalidatePath(`/admin/users/${targetUserId}`)
  return { success: true }
}
