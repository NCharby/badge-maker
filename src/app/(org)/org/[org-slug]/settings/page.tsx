import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrgSettingsClient from './OrgSettingsClient'

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ 'org-slug': string }>
}) {
  const { 'org-slug': orgSlug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: org } = await admin
    .from('organizations')
    .select('id, name, slug, website, social_media, payment_provider, logo_url')
    .eq('slug', orgSlug)
    .single()
  if (!org) redirect('/dashboard')

  // Verify caller is OL (settings are OL-only)
  const { data: callerProfile } = await supabase
    .from('platform_users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isSa = callerProfile?.role === 'system_admin'

  if (!isSa) {
    const { data: membership } = await admin
      .from('organization_members')
      .select('access_level')
      .eq('organization_id', org.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membership?.access_level !== 'organization_lead') {
      redirect(`/org/${orgSlug}/dashboard`)
    }
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        Organization Settings
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        {org.name}
      </p>

      <OrgSettingsClient
        orgSlug={orgSlug}
        org={{
          name: org.name,
          website: org.website ?? '',
          socialMedia: (org.social_media as { key: string; value: string }[] | null) ?? [],
          paymentProvider: (org.payment_provider as 'square' | 'paypal' | null) ?? null,
        }}
      />
    </div>
  )
}
