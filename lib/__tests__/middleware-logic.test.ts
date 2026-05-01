// Tests for middleware logic extracted into pure functions
// These test the decision logic without needing Next.js runtime

const ARTIST_ROUTES = ['/dashboard']
const PUBLIC_ROUTES = ['/', '/auth', '/signup', '/explore', '/discover', '/release', '/search', '/faq', '/redeem', '/download', '/why-us', '/for-artists', '/for-fans', '/for-press', '/privacy', '/terms', '/ai-policy']
const AUTH_EXCLUDED = ['/auth', '/signup', '/auth/callback', '/welcome', '/become-an-artist', '/api']

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

function isPublicRoute(path: string): boolean {
  const isProfileRoute = /^\/[^/]+$/.test(path) && !ARTIST_ROUTES.some(r => path.startsWith(r))
  const isMerchRoute = /^\/[^/]+\/merch\/[^/]+$/.test(path)
  return isProfileRoute || isMerchRoute || PUBLIC_ROUTES.some(r => path === r) || AUTH_EXCLUDED.some(r => path.startsWith(r))
}

function shouldBlockCsrf(path: string, method: string, origin: string | null, siteHost: string): boolean {
  if (!path.startsWith('/api') || method === 'GET' || method === 'HEAD') return false
  if (!origin) return true
  try {
    const originHost = new URL(origin).hostname
    if (originHost !== siteHost && originHost !== `www.${siteHost}` && `www.${originHost}` !== siteHost) {
      return true
    }
  } catch {
    return true
  }
  return false
}

function detectCountry(cfCountry: string | null, acceptLang: string | null): string | null {
  if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') return cfCountry
  if (acceptLang) {
    const match = acceptLang.match(/[a-z]{2}-([A-Z]{2})/)
    if (match) return match[1]
  }
  return null
}

// ── CSRF protection ──

describe('CSRF protection', () => {
  const siteHost = 'getinsound.com'

  it('allows GET requests without origin', () => {
    expect(shouldBlockCsrf('/api/search', 'GET', null, siteHost)).toBe(false)
  })

  it('allows HEAD requests without origin', () => {
    expect(shouldBlockCsrf('/api/test', 'HEAD', null, siteHost)).toBe(false)
  })

  it('blocks POST with no origin', () => {
    expect(shouldBlockCsrf('/api/follow', 'POST', null, siteHost)).toBe(true)
  })

  it('blocks DELETE with no origin', () => {
    expect(shouldBlockCsrf('/api/follow', 'DELETE', null, siteHost)).toBe(true)
  })

  it('blocks PATCH with no origin', () => {
    expect(shouldBlockCsrf('/api/notifications', 'PATCH', null, siteHost)).toBe(true)
  })

  it('allows same-origin POST', () => {
    expect(shouldBlockCsrf('/api/follow', 'POST', 'https://getinsound.com', siteHost)).toBe(false)
  })

  it('allows www variant', () => {
    expect(shouldBlockCsrf('/api/follow', 'POST', 'https://www.getinsound.com', siteHost)).toBe(false)
  })

  it('blocks cross-origin POST', () => {
    expect(shouldBlockCsrf('/api/follow', 'POST', 'https://evil.com', siteHost)).toBe(true)
  })

  it('blocks malformed origin', () => {
    expect(shouldBlockCsrf('/api/follow', 'POST', 'not-a-url', siteHost)).toBe(true)
  })

  it('does not apply CSRF to non-API routes', () => {
    expect(shouldBlockCsrf('/dashboard', 'POST', null, siteHost)).toBe(false)
  })
})

// ── Route classification ──

describe('route classification', () => {
  it('public routes are accessible without auth', () => {
    for (const route of PUBLIC_ROUTES) {
      expect(isPublicRoute(route)).toBe(true)
    }
  })

  it('artist profiles are public (single segment)', () => {
    expect(isPublicRoute('/radiohead')).toBe(true)
    expect(isPublicRoute('/my-band')).toBe(true)
  })

  it('fan profiles are public (single segment starting with @)', () => {
    expect(isPublicRoute('/@username')).toBe(true)
  })

  it('merch pages are public', () => {
    expect(isPublicRoute('/artist-slug/merch/product-id')).toBe(true)
  })

  it('dashboard is NOT public', () => {
    expect(isPublicRoute('/dashboard')).toBe(false)
  })

  it('nested dashboard routes are NOT public', () => {
    expect(isPublicRoute('/dashboard/releases')).toBe(false)
    expect(isPublicRoute('/dashboard/orders')).toBe(false)
  })

  it('/library matches profile-route pattern (single segment)', () => {
    // /library is a single-segment path not under /dashboard, so middleware treats it like a profile route
    expect(isPublicRoute('/library')).toBe(true)
  })

  it('/settings matches profile-route pattern (single segment)', () => {
    expect(isPublicRoute('/settings')).toBe(true)
  })

  it('API routes are excluded from auth redirect', () => {
    expect(isPublicRoute('/api/search')).toBe(true)
    expect(isPublicRoute('/api/auth/signup')).toBe(true)
  })

  it('auth routes are excluded from auth redirect', () => {
    expect(isPublicRoute('/auth/callback')).toBe(true)
    expect(isPublicRoute('/signup')).toBe(true)
    expect(isPublicRoute('/welcome')).toBe(true)
    expect(isPublicRoute('/become-an-artist')).toBe(true)
  })
})

// ── Constant-time comparison ──

describe('constantTimeEqual', () => {
  it('returns true for equal strings', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true)
  })

  it('returns false for different strings', () => {
    expect(constantTimeEqual('abc', 'xyz')).toBe(false)
  })

  it('returns false for different lengths', () => {
    expect(constantTimeEqual('short', 'longer-string')).toBe(false)
  })

  it('returns true for empty strings', () => {
    expect(constantTimeEqual('', '')).toBe(true)
  })

  it('returns false for empty vs non-empty', () => {
    expect(constantTimeEqual('', 'a')).toBe(false)
  })
})

// ── Country detection ──

describe('detectCountry', () => {
  it('uses CF header when valid', () => {
    expect(detectCountry('GB', null)).toBe('GB')
  })

  it('ignores XX Tor exit node', () => {
    expect(detectCountry('XX', null)).toBeNull()
  })

  it('ignores T1 Tor exit node', () => {
    expect(detectCountry('T1', null)).toBeNull()
  })

  it('falls back to accept-language', () => {
    expect(detectCountry(null, 'en-GB,en;q=0.9')).toBe('GB')
  })

  it('extracts country from accept-language', () => {
    expect(detectCountry(null, 'de-DE,de;q=0.9,en-US;q=0.8')).toBe('DE')
  })

  it('returns null when no detection possible', () => {
    expect(detectCountry(null, null)).toBeNull()
  })

  it('returns null for accept-language without country', () => {
    expect(detectCountry(null, 'en')).toBeNull()
  })

  it('prefers CF header over accept-language', () => {
    expect(detectCountry('US', 'en-GB')).toBe('US')
  })
})
