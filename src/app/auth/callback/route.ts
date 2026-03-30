import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

/**
 * Auth callback handler.
 *
 * Supabase sends users here after:
 *   - Email verification (account creation)
 *   - Password reset
 *
 * The route exchanges the PKCE code for a session cookie, then
 * redirects to the appropriate destination:
 *   - Email confirmation → /dashboard
 *   - Password recovery  → /reset-password?type=recovery
 *   - Custom next param  → ?next=<path>
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const next = searchParams.get('next') || '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      if (type === 'recovery') {
        // Password recovery — redirect to reset-password page so the user can set a new password
        return NextResponse.redirect(`${origin}/reset-password?type=recovery`)
      }
      if (type === 'email_change') {
        // Email change confirmed — sync new email into platform_users
        const { data: { user: updatedUser } } = await supabase.auth.getUser()
        if (updatedUser?.email) {
          const adminSupabase = createAdminClient()
          await adminSupabase
            .from('platform_users')
            .update({ email: updatedUser.email })
            .eq('id', updatedUser.id)
        }
        return NextResponse.redirect(`${origin}/profile`)
      }
      // Default path — new signup confirmation. Create platform_users from user_metadata
      // if the row doesn't exist yet (idempotent: safe to re-visit the confirmation link).
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const admin = createAdminClient()
        const { data: existing } = await admin
          .from('platform_users')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()
        if (!existing) {
          const meta = user.user_metadata ?? {}
          await admin.from('platform_users').insert({
            id: user.id,
            email: user.email!,
            date_of_birth: meta.date_of_birth,
            telegram_handle: meta.telegram_handle ?? null,
            preferred_scene_name: meta.preferred_scene_name ?? null,
            role: 'user',
          })
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Error or missing code — redirect to login with an error indicator
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
