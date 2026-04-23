import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getCurrencyForCountry } from './app/lib/currency'

const ARTIST_ROUTES = ['/dashboard', '/release']
const PUBLIC_ROUTES = ['/', '/auth', '/signup', '/explore', '/discover', '/why-us', '/for-artists', '/for-fans', '/for-press', '/privacy', '/terms', '/ai-policy']
const AUTH_EXCLUDED = ['/auth', '/signup', '/auth/callback', '/welcome', '/become-an-artist', '/api']

const THIRTY_DAYS = 60 * 60 * 24 * 30

function detectCountry(request: NextRequest): string | null {
  const cfCountry = request.headers.get('cf-ipcountry')
  if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') return cfCountry

  const acceptLang = request.headers.get('accept-language')
  if (acceptLang) {
    const match = acceptLang.match(/[a-z]{2}-([A-Z]{2})/)
    if (match) return match[1]
  }

  return null
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // ── Locale detection (compute only, set cookies at end) ───
  let detectedCountry: string | null = null
  let detectedCurrency: string | null = null
  const hasLocale = request.cookies.has('insound_locale')
  if (!hasLocale) {
    detectedCountry = detectCountry(request)
    if (detectedCountry) {
      detectedCurrency = getCurrencyForCountry(detectedCountry)
    }
  }

  // Capture referral code from ?ref= into a cookie (7-day expiry)
  const refCode = request.nextUrl.searchParams.get('ref')

  // ── Supabase auth (may rebuild supabaseResponse via setAll) ──
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }: { name: string; value: string }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: Record<string, unknown> }) =>
            supabaseResponse.cookies.set(name, value, options as any)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Protect artist-only routes
  if (user && ARTIST_ROUTES.some(r => path.startsWith(r))) {
    const [{ data: artist }, { data: account }] = await Promise.all([
      supabase.from('artists').select('id').eq('id', user.id).maybeSingle(),
      supabase.from('artist_accounts').select('id').eq('id', user.id).maybeSingle(),
    ])

    if (!artist || !account) {
      const url = request.nextUrl.clone()
      url.pathname = '/become-an-artist'
      return NextResponse.redirect(url)
    }
  }

  // Redirect unauthenticated users away from protected routes
  // Single-segment paths are public profiles (artists: /slug, fans: /@username)
  // Multi-segment paths under artist slugs (e.g. /slug/merch/id) are also public
  const isProfileRoute = /^\/[^/]+$/.test(path) && !ARTIST_ROUTES.some(r => path.startsWith(r))
  const isMerchRoute = /^\/[^/]+\/merch\/[^/]+$/.test(path)
  if (!user && !isProfileRoute && !isMerchRoute && !PUBLIC_ROUTES.some(r => path === r) && !AUTH_EXCLUDED.some(r => path.startsWith(r))) {
    const url = request.nextUrl.clone()
    url.pathname = '/signup'
    return NextResponse.redirect(url)
  }

  // ── Session activity tracking (throttled to every 5 minutes) ──
  if (user) {
    const sessionId = request.cookies.get('session_id')?.value
    const lastTracked = request.cookies.get('session_tracked')?.value
    if (sessionId && !lastTracked) {
      supabase.rpc('touch_session', { p_session_id: sessionId }).then(() => {})
      supabaseResponse.cookies.set('session_tracked', '1', {
        path: '/',
        maxAge: 300,
        httpOnly: true,
        sameSite: 'lax',
      })
    }
  }

  // ── Set locale cookies (after Supabase may have rebuilt response) ──
  if (detectedCountry) {
    supabaseResponse.cookies.set('insound_locale', detectedCountry, {
      path: '/',
      maxAge: THIRTY_DAYS,
      sameSite: 'lax',
    })
    if (detectedCurrency && !request.cookies.has('insound_currency')) {
      supabaseResponse.cookies.set('insound_currency', detectedCurrency, {
        path: '/',
        maxAge: THIRTY_DAYS,
        sameSite: 'lax',
      })
    }
  }

  if (refCode && /^[A-Z0-9]{6}$/.test(refCode)) {
    supabaseResponse.cookies.set('insound_ref', refCode, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
      httpOnly: false,
    })
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|zip|pdf)$).*)',
  ],
}
