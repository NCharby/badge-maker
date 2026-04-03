'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateDefaultOrganization(
  organizationId: string | null
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Validate the org exists and user is a member (if not null)
  if (organizationId) {
    const admin = createAdminClient()
    const { data: membership } = await admin
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) return { error: 'You are not a member of this organization.' }
  }

  const { error } = await supabase
    .from('platform_users')
    .update({ default_organization_id: organizationId })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profile/organization')
  revalidatePath('/profile')
  return { success: true }
}
