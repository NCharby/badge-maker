import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { PlatformRole } from '@/types/platform'

/**
 * Platform session guard and role-based routing.
 *
 * Protected route groups:
 *   /(platform)/* — any authenticated platform_user
 *   /(ep)/*       — role must be 'event_promoter' or 'system_admin'
 *   /(admin)/*    — role must be 'system_admin'
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — required on every request to keep it alive
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Unauthenticated users hitting protected routes → /login ───────────────
  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/events') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/ep') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/org')

  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── Authenticated users: enforce role for EP and Admin routes ─────────────
  if (user && (pathname.startsWith('/ep') || pathname.startsWith('/admin'))) {
    const { data: platformUser } = await supabase
      .from('platform_users')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = platformUser?.role as PlatformRole | undefined

    if (pathname.startsWith('/admin') && role !== 'system_admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    if (
      pathname.startsWith('/ep') &&
      role !== 'event_promoter' &&
      role !== 'system_admin'
    ) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // ── Already-authenticated users hitting auth pages → role-based home ────────
  if (user && (pathname === '/login' || pathname === '/register')) {
    const { data: platformUser } = await supabase
      .from('platform_users')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = platformUser?.role as PlatformRole | undefined
    if (role === 'system_admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }
    if (role === 'event_promoter') {
      return NextResponse.redirect(new URL('/ep/dashboard', request.url))
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, sitemap.xml, robots.txt
     * - /api/* (API routes handle their own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/).*)',
  ],
}
