import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Supabase client for use in Server Components, Server Actions, and Route Handlers.
 * Uses @supabase/ssr cookie-based session management for Next.js App Router.
 * DO NOT use src/lib/supabase.ts for platform code — that file is badge-maker only.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — middleware handles session refresh
          }
        },
      },
    }
  )
}

/**
 * Supabase admin client using the service role key.
 * Uses @supabase/supabase-js directly (NOT @supabase/ssr) so that the service
 * role key is used as-is without cookie session injection overriding it.
 * Use only in Server Components, Route Handlers, and Server Actions that
 * require bypassing RLS. Never expose the service role key to the client.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
