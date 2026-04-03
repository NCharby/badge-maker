'use server'

import { createAdminClient } from '@/lib/supabase/server'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60)
}

export async function registerDevUser(fields: {
  firstName: string
  lastName: string
  email: string
  password: string
  dob: string
  telegramHandle: string | null
  sceneName: string | null
  orgName: string | null
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
      first_name: fields.firstName,
      last_name: fields.lastName,
      date_of_birth: fields.dob,
      telegram_handle: fields.telegramHandle,
      preferred_scene_name: fields.sceneName,
      org_name: fields.orgName,
    },
  })
  if (authError) return { error: `Account creation failed: ${authError.message}` }
  if (!authData?.user?.id) return { error: 'Account creation failed: no user ID returned.' }

  const userId = authData.user.id

  // Determine role — org creators start as event_promoter
  const role = fields.orgName ? 'event_promoter' : 'user'

  const { error: profileError } = await admin.from('platform_users').upsert({
    id: userId,
    email: fields.email,
    first_name: fields.firstName,
    last_name: fields.lastName,
    date_of_birth: fields.dob,
    telegram_handle: fields.telegramHandle,
    preferred_scene_name: fields.sceneName,
    role,
  }, { onConflict: 'id', ignoreDuplicates: false })
  if (profileError) return { error: `Profile setup failed: ${profileError.message}` }

  // Create organization if requested
  if (fields.orgName) {
    const orgResult = await createOrgForUser(admin, userId, fields.orgName)
    if ('error' in orgResult) return { error: orgResult.error }
  }

  return { success: true as const }
}

/** Shared helper: creates an org and adds the user as Organization Lead. */
export async function createOrgForUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userId: string,
  orgName: string,
): Promise<{ success: true; orgId: string } | { error: string }> {
  // Get free tier
  const { data: freeTier } = await admin
    .from('organization_tiers')
    .select('id')
    .eq('name', 'free')
    .single()
  if (!freeTier) return { error: 'Free tier not found. Check database migrations.' }

  const slug = slugify(orgName)
  if (!slug) return { error: 'Invalid organization name.' }

  // Check slug uniqueness — append random suffix if taken
  let finalSlug = slug
  const { data: existing } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (existing) {
    finalSlug = `${slug}-${Date.now().toString(36).slice(-4)}`
  }

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({
      name: orgName.trim(),
      slug: finalSlug,
      tier_id: freeTier.id,
    })
    .select('id')
    .single()
  if (orgError) return { error: `Organization creation failed: ${orgError.message}` }

  // Add user as Organization Lead
  const { error: memberError } = await admin
    .from('organization_members')
    .insert({
      organization_id: org.id,
      user_id: userId,
      access_level: 'organization_lead',
      promoted_via_org: true,
    })
  if (memberError) return { error: `Organization membership failed: ${memberError.message}` }

  return { success: true, orgId: org.id }
}
