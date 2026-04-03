'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: pu } = await supabase
    .from('platform_users')
    .select('role')
    .eq('id', user.id)
    .single()

  return pu?.role === 'system_admin' ? user : null
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60)
}

// ── Create Organization ─────────────────────────────────────────────────────

export async function createOrganization(data: {
  name: string
  website?: string
  paymentProvider?: 'square' | 'paypal'
}): Promise<{ success: true; orgId: string } | { error: string }> {
  const user = await requireAdmin()
  if (!user) return { error: 'Access denied.' }

  if (!data.name.trim()) return { error: 'Organization name is required.' }

  const admin = createAdminClient()

  // Get free tier
  const { data: freeTier } = await admin
    .from('organization_tiers')
    .select('id')
    .eq('name', 'free')
    .single()
  if (!freeTier) return { error: 'Free tier not found. Check migrations.' }

  const slug = slugify(data.name)
  if (!slug) return { error: 'Invalid organization name.' }

  // Check slug uniqueness
  const { data: existing } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (existing) return { error: `An organization with the slug "${slug}" already exists.` }

  const { data: org, error } = await admin
    .from('organizations')
    .insert({
      name: data.name.trim(),
      slug,
      website: data.website?.trim() || null,
      payment_provider: data.paymentProvider || null,
      tier_id: freeTier.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/admin/organizations')
  return { success: true, orgId: org.id }
}

// ── Update Organization ─────────────────────────────────────────────────────

export async function updateOrganization(
  orgId: string,
  data: {
    name?: string
    website?: string
    paymentProvider?: 'square' | 'paypal' | null
  }
): Promise<{ success: true } | { error: string }> {
  const user = await requireAdmin()
  if (!user) return { error: 'Access denied.' }

  const admin = createAdminClient()
  const updates: Record<string, unknown> = {}
  if (data.name !== undefined) updates.name = data.name.trim()
  if (data.website !== undefined) updates.website = data.website.trim() || null
  if (data.paymentProvider !== undefined) updates.payment_provider = data.paymentProvider

  const { error } = await admin
    .from('organizations')
    .update(updates)
    .eq('id', orgId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/organizations/${orgId}`)
  revalidatePath('/admin/organizations')
  return { success: true }
}

// ── Archive / Unarchive Organization ────────────────────────────────────────

export async function toggleArchiveOrganization(
  orgId: string,
  archived: boolean
): Promise<{ success: true } | { error: string }> {
  const user = await requireAdmin()
  if (!user) return { error: 'Access denied.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('organizations')
    .update({ archived })
    .eq('id', orgId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/organizations/${orgId}`)
  revalidatePath('/admin/organizations')
  return { success: true }
}

// ── Add Member to Organization ──────────────────────────────────────────────

export async function addOrgMember(
  orgId: string,
  userEmail: string,
  accessLevel: 'organization_lead' | 'event_promoter' | 'module_lead' | 'user'
): Promise<{ success: true } | { error: string }> {
  const user = await requireAdmin()
  if (!user) return { error: 'Access denied.' }

  const admin = createAdminClient()

  // Find the platform user by email
  const { data: target } = await admin
    .from('platform_users')
    .select('id, role')
    .eq('email', userEmail.trim().toLowerCase())
    .single()

  if (!target) return { error: `No platform user found with email "${userEmail}".` }

  // Check not already a member
  const { data: existing } = await admin
    .from('organization_members')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', target.id)
    .maybeSingle()

  if (existing) return { error: 'This user is already a member of this organization.' }

  // Auto-promote to event_promoter if currently a regular user
  const needsPromotion = target.role === 'user'

  const { error: memberError } = await admin
    .from('organization_members')
    .insert({
      organization_id: orgId,
      user_id: target.id,
      access_level: accessLevel,
      promoted_via_org: needsPromotion,
    })

  if (memberError) return { error: memberError.message }

  // Promote platform role if needed
  if (needsPromotion) {
    await admin
      .from('platform_users')
      .update({ role: 'event_promoter' })
      .eq('id', target.id)
  }

  revalidatePath(`/admin/organizations/${orgId}`)
  return { success: true }
}

// ── Remove Member from Organization ─────────────────────────────────────────

export async function removeOrgMember(
  orgId: string,
  memberId: string
): Promise<{ success: true } | { error: string }> {
  const user = await requireAdmin()
  if (!user) return { error: 'Access denied.' }

  const admin = createAdminClient()

  // Fetch member to check if we need to demote
  const { data: member } = await admin
    .from('organization_members')
    .select('user_id, promoted_via_org')
    .eq('id', memberId)
    .eq('organization_id', orgId)
    .single()

  if (!member) return { error: 'Member not found.' }

  const { error } = await admin
    .from('organization_members')
    .delete()
    .eq('id', memberId)

  if (error) return { error: error.message }

  // If this user was auto-promoted and has no other org memberships, demote back to user
  if (member.promoted_via_org) {
    const { count } = await admin
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', member.user_id)

    if (!count || count === 0) {
      await admin
        .from('platform_users')
        .update({ role: 'user' })
        .eq('id', member.user_id)
    }
  }

  revalidatePath(`/admin/organizations/${orgId}`)
  return { success: true }
}

// ── Update Member Access Level ──────────────────────────────────────────────

export async function updateMemberAccessLevel(
  orgId: string,
  memberId: string,
  accessLevel: 'organization_lead' | 'event_promoter' | 'module_lead' | 'user'
): Promise<{ success: true } | { error: string }> {
  const user = await requireAdmin()
  if (!user) return { error: 'Access denied.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('organization_members')
    .update({ access_level: accessLevel })
    .eq('id', memberId)
    .eq('organization_id', orgId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/organizations/${orgId}`)
  return { success: true }
}
