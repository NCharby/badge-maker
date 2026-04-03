'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkOrgAccess } from '@/lib/auth/event-access'
import { revalidatePath } from 'next/cache'
import type { OrgAccessLevel } from '@/types/platform'

/** Resolves org ID from slug and verifies caller has OL or EP access. */
async function requireOrgAccess(
  orgSlug: string,
  minLevel: 'organization_lead' | 'event_promoter' = 'event_promoter',
): Promise<{ orgId: string; userId: string; accessLevel: OrgAccessLevel } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const admin = createAdminClient()
  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .single()
  if (!org) return { error: 'Organization not found.' }

  const access = await checkOrgAccess(user.id, org.id)
  if (!access.authorized) return { error: 'Access denied.' }

  const level = access.accessLevel as OrgAccessLevel
  if (minLevel === 'organization_lead' && level !== 'organization_lead') {
    // System admins pass through checkOrgAccess as 'organization_lead'
    return { error: 'Only Organization Leads can perform this action.' }
  }

  return { orgId: org.id, userId: user.id, accessLevel: level }
}

// ── Update Organization Settings ────────────────────────────────────────────

export async function updateOrgSettings(
  orgSlug: string,
  data: {
    name?: string
    website?: string
    socialMedia?: { key: string; value: string }[]
    paymentProvider?: 'square' | 'paypal' | null
  }
): Promise<{ success: true } | { error: string }> {
  const auth = await requireOrgAccess(orgSlug, 'organization_lead')
  if ('error' in auth) return { error: auth.error }

  const admin = createAdminClient()
  const updates: Record<string, unknown> = {}
  if (data.name !== undefined) updates.name = data.name.trim()
  if (data.website !== undefined) updates.website = data.website.trim() || null
  if (data.socialMedia !== undefined) updates.social_media = data.socialMedia.filter(s => s.key.trim() && s.value.trim())
  if (data.paymentProvider !== undefined) updates.payment_provider = data.paymentProvider

  const { error } = await admin
    .from('organizations')
    .update(updates)
    .eq('id', auth.orgId)
  if (error) return { error: error.message }

  revalidatePath(`/org/${orgSlug}/settings`)
  revalidatePath(`/org/${orgSlug}/dashboard`)
  return { success: true }
}

// ── Invite Member ───────────────────────────────────────────────────────────

export async function inviteOrgMember(
  orgSlug: string,
  email: string,
  accessLevel: 'event_promoter' | 'module_lead',
): Promise<{ success: true; method: 'added' | 'invited' } | { error: string }> {
  const auth = await requireOrgAccess(orgSlug, 'organization_lead')
  if ('error' in auth) return { error: auth.error }

  const admin = createAdminClient()
  const targetEmail = email.trim().toLowerCase()

  // Check if already a member
  const { data: existingMember } = await admin
    .from('organization_members')
    .select('id')
    .eq('organization_id', auth.orgId)
    .eq('user_id', (
      await admin.from('platform_users').select('id').eq('email', targetEmail).maybeSingle()
    ).data?.id ?? '00000000-0000-0000-0000-000000000000')
    .maybeSingle()

  if (existingMember) return { error: 'This user is already a member of this organization.' }

  // Check if the user exists on the platform
  const { data: targetUser } = await admin
    .from('platform_users')
    .select('id, role')
    .eq('email', targetEmail)
    .maybeSingle()

  if (targetUser) {
    // User exists — add them directly
    const needsPromotion = targetUser.role === 'user'

    const { error: memberError } = await admin
      .from('organization_members')
      .insert({
        organization_id: auth.orgId,
        user_id: targetUser.id,
        access_level: accessLevel,
        promoted_via_org: needsPromotion,
      })
    if (memberError) return { error: memberError.message }

    if (needsPromotion) {
      await admin.from('platform_users').update({ role: 'event_promoter' }).eq('id', targetUser.id)
    }

    revalidatePath(`/org/${orgSlug}/members`)
    return { success: true, method: 'added' }
  }

  // User does not exist — create a pending invitation
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

  const { error: inviteError } = await admin
    .from('organization_invitations')
    .insert({
      organization_id: auth.orgId,
      invited_by: auth.userId,
      email: targetEmail,
      access_level: accessLevel,
      token,
      expires_at: expiresAt,
    })
  if (inviteError) return { error: inviteError.message }

  // TODO: send invitation email via Resend with registration link containing the token

  revalidatePath(`/org/${orgSlug}/members`)
  return { success: true, method: 'invited' }
}

// ── Change Member Access Level ──────────────────────────────────────────────

export async function changeOrgMemberLevel(
  orgSlug: string,
  memberId: string,
  newLevel: OrgAccessLevel,
): Promise<{ success: true } | { error: string }> {
  const auth = await requireOrgAccess(orgSlug)
  if ('error' in auth) return { error: auth.error }

  // EPs can only set module_lead or user; OLs can set anything
  if (auth.accessLevel === 'event_promoter' && newLevel !== 'module_lead' && newLevel !== 'user') {
    return { error: 'Event Promoters can only assign Module Lead or Member access.' }
  }

  const admin = createAdminClient()

  // EPs cannot modify OL or EP members
  if (auth.accessLevel === 'event_promoter') {
    const { data: target } = await admin
      .from('organization_members')
      .select('access_level')
      .eq('id', memberId)
      .eq('organization_id', auth.orgId)
      .single()
    if (target && (target.access_level === 'organization_lead' || target.access_level === 'event_promoter')) {
      return { error: 'You cannot modify the access level of Organization Leads or Event Promoters.' }
    }
  }

  const { error } = await admin
    .from('organization_members')
    .update({ access_level: newLevel })
    .eq('id', memberId)
    .eq('organization_id', auth.orgId)
  if (error) return { error: error.message }

  revalidatePath(`/org/${orgSlug}/members`)
  return { success: true }
}

// ── Update Module Lead Access (per-event, per-module) ──────────────────────

export async function updateMemberModuleAccess(
  orgSlug: string,
  memberId: string,
  eventId: string,
  moduleKeys: string[],
): Promise<{ success: true } | { error: string }> {
  const auth = await requireOrgAccess(orgSlug)
  if ('error' in auth) return { error: auth.error }

  const admin = createAdminClient()

  // Verify target member exists and belongs to this org
  const { data: member } = await admin
    .from('organization_members')
    .select('id, access_level, user_id')
    .eq('id', memberId)
    .eq('organization_id', auth.orgId)
    .single()
  if (!member) return { error: 'Member not found.' }

  if (member.access_level !== 'module_lead') {
    return { error: 'Module access can only be configured for Module Leads.' }
  }

  // Verify event belongs to this org
  const { data: event } = await admin
    .from('platform_events')
    .select('id, module_config')
    .eq('id', eventId)
    .eq('organization_id', auth.orgId)
    .single()
  if (!event) return { error: 'Event not found in this organization.' }

  // Validate that each requested module is actually enabled on the event
  const moduleConfig = (event.module_config ?? {}) as Record<string, { enabled?: boolean }>
  const invalidModules = moduleKeys.filter(key => !moduleConfig[key]?.enabled)
  if (invalidModules.length > 0) {
    return { error: `Modules not enabled on this event: ${invalidModules.join(', ')}` }
  }

  // Delete existing grants for this member + event, then insert new ones
  await admin
    .from('organization_module_access')
    .delete()
    .eq('organization_member_id', memberId)
    .eq('event_id', eventId)

  if (moduleKeys.length > 0) {
    const rows = moduleKeys.map(key => ({
      organization_member_id: memberId,
      event_id: eventId,
      module_key: key,
    }))
    const { error: insertError } = await admin
      .from('organization_module_access')
      .insert(rows)
    if (insertError) return { error: insertError.message }
  }

  revalidatePath(`/org/${orgSlug}/members/${member.user_id}`)
  return { success: true }
}

// ── Remove Member ───────────────────────────────────────────────────────────

export async function removeOrgMemberByOl(
  orgSlug: string,
  memberId: string,
): Promise<{ success: true } | { error: string }> {
  const auth = await requireOrgAccess(orgSlug, 'organization_lead')
  if ('error' in auth) return { error: auth.error }

  const admin = createAdminClient()

  const { data: member } = await admin
    .from('organization_members')
    .select('user_id, promoted_via_org')
    .eq('id', memberId)
    .eq('organization_id', auth.orgId)
    .single()
  if (!member) return { error: 'Member not found.' }

  // Prevent OL from removing themselves if they're the last OL
  if (member.user_id === auth.userId) {
    const { count } = await admin
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', auth.orgId)
      .eq('access_level', 'organization_lead')
    if ((count ?? 0) <= 1) return { error: 'Cannot remove the last Organization Lead.' }
  }

  const { error } = await admin.from('organization_members').delete().eq('id', memberId)
  if (error) return { error: error.message }

  // Demote if auto-promoted and no other org memberships remain
  if (member.promoted_via_org) {
    const { count } = await admin
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', member.user_id)
    if (!count || count === 0) {
      await admin.from('platform_users').update({ role: 'user' }).eq('id', member.user_id)
    }
  }

  revalidatePath(`/org/${orgSlug}/members`)
  return { success: true }
}
