import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import UserDetailClient from './UserDetailClient'

export default async function AdminUserDetailPage({
  params,
}: {
  params: { 'user-id': string }
}) {
  const userId = params['user-id']

  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) notFound()

  const admin = createAdminClient()
  const { data: targetUser } = await admin
    .from('platform_users')
    .select(
      'id, email, preferred_scene_name, role, payment_provider, telegram_handle, telegram_verified, date_of_birth, created_at, phone, address, zip_code'
    )
    .eq('id', userId)
    .single()

  if (!targetUser) notFound()

  const displayName = targetUser.preferred_scene_name || targetUser.email.split('@')[0]

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <Link
          href="/admin/users"
          style={{ fontSize: '13px', color: 'var(--sd-muted)', textDecoration: 'none' }}
        >
          ← All Users
        </Link>
      </div>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '0.25rem' }}>
        {displayName}
      </h1>
      <p style={{ color: 'var(--sd-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        {targetUser.email}
      </p>

      <UserDetailClient
        targetUser={targetUser}
        currentUserId={currentUser.id}
      />
    </div>
  )
}
