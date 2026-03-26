import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase client for use in Client Components ('use client').
 * Uses @supabase/ssr for consistent cookie-based session management.
 * DO NOT use src/lib/supabase.ts for platform code — that file is badge-maker only.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
