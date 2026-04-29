import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getCurrencyForCountry } from './app/lib/currency'

const ARTIST_ROUTES = ['/dashboard']
const PUBLIC_ROUTES = ['/', '/auth', '/signup', '/explore', '/discover', '/release', '/search', '/faq', '/redeem', '/download', '/why-us', '/for-artists', '/for-fans', '/for-press', '/privacy', '/terms', '/ai-policy']
const AUTH_EXCLUDED = ['/auth', '/signup', '/auth/callback', '/welcome', '/become-an-artist', '/api']

const THIRTY_DAYS = 60 * 60 * 24 * 30

function constantTimeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length)
  const paddedA = a.padEnd(maxLen, '\0')
  const paddedB = b.padEnd(maxLen, '\0')
  let result = a.length ^ b.length
  for (let i = 0; i < maxLen; i++) {
    result |= paddedA.charCodeAt(i) ^ paddedB.charCodeAt(i)
  }
  return result === 0
}

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

  // ── CSRF protection for state-changing API requests ──
  if (path.startsWith('/api') && request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('origin')
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://getinsound.com'
    if (origin) {
      try {
        const originHost = new URL(origin).hostname
        const siteHost = new URL(siteUrl).hostname
        if (originHost !== siteHost && originHost !== `www.${siteHost}` && `www.${originHost}` !== siteHost) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
  }

  // ── Preview bypass ──
  const previewParam = request.nextUrl.searchParams.get('preview')
  const previewToken = process.env.PREVIEW_TOKEN

  if (previewParam === 'clear') {
    const url = request.nextUrl.clone()
    url.searchParams.delete('preview')
    const clearResponse = NextResponse.redirect(url)
    clearResponse.cookies.set('insound-preview', '', {
      path: '/',
      maxAge: 0,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    })
    return clearResponse
  }

  if (previewParam && previewToken && constantTimeEqual(previewParam, previewToken)) {
    const url = request.nextUrl.clone()
    url.searchParams.delete('preview')
    const previewResponse = NextResponse.redirect(url)
    previewResponse.cookies.set('insound-preview', 'true', {
      path: '/',
      maxAge: THIRTY_DAYS,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    })
    return previewResponse
  }

  const hasPreviewAccess = request.cookies.get('insound-preview')?.value === 'true'

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
  if (!user && !hasPreviewAccess && !isProfileRoute && !isMerchRoute && !PUBLIC_ROUTES.some(r => path === r) && !AUTH_EXCLUDED.some(r => path.startsWith(r))) {
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
        secure: true,
        sameSite: 'lax',
      })
    }
  }

  // ── Set locale cookies (after Supabase may have rebuilt response) ──
  // Only set functional cookies if the user has given consent
  const consentValue = request.cookies.get('insound_consent')?.value
  const hasFunctionalConsent = consentValue === 'accepted' || consentValue === 'functional'

  if (detectedCountry && hasFunctionalConsent) {
    supabaseResponse.cookies.set('insound_locale', detectedCountry, {
      path: '/',
      maxAge: THIRTY_DAYS,
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
    })
    if (detectedCurrency && !request.cookies.has('insound_currency')) {
      supabaseResponse.cookies.set('insound_currency', detectedCurrency, {
        path: '/',
        maxAge: THIRTY_DAYS,
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
      })
    }
  }


  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|zip|pdf)$).*)',
  ],
}
