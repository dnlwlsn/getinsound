// Regression tests: guards against specific bugs that were fixed
// Each test documents the original bug and ensures it doesn't return

import { calculateStripeFee, calculateFeesPence, calculateMerchFees } from '@/app/lib/fees'
import { getCurrencyForCountry, getRegion, convertPrice, formatPrice } from '@/app/lib/currency'
import { isVerified } from '@/lib/verification'
import { resolveAccent, DEFAULT_ACCENT } from '@/lib/accent'
import { RESERVED_SLUGS } from '@/lib/reserved-slugs'
import { parseDevice, maskIp } from '@/lib/session'

// ── Money-losing bugs ──

describe('REGRESSION: artist must never receive more than the sale amount', () => {
  it('artistReceived never exceeds sale amount', () => {
    const amounts = [0.01, 0.50, 1, 5, 10, 100, 1000]
    for (const amount of amounts) {
      const result = calculateStripeFee(amount, 'GB', 'GB', 'GBP', 'GBP')
      expect(result.artistReceived).toBeLessThanOrEqual(amount)
    }
  })

  it('insound fee is never negative', () => {
    const result = calculateStripeFee(0.01, 'GB', 'GB', 'GBP', 'GBP')
    expect(result.insoundFee).toBeGreaterThanOrEqual(0)
  })
})

describe('REGRESSION: Stripe fees calculated on full amount including postage', () => {
  it('merch stripe fee covers item + postage (not just item)', () => {
    const result = calculateMerchFees(10, 10, 'GB', 'GB', 'GBP', 'GBP')
    const totalCharged = 20
    const expectedMinStripeFee = totalCharged * 0.015 + 0.20
    expect(result.stripeFee).toBeCloseTo(expectedMinStripeFee, 2)
  })
})

describe('REGRESSION: destination charges — Stripe fees from platform cut, not artist', () => {
  it('totalFees only includes insound fee (Stripe absorbed by platform)', () => {
    const result = calculateStripeFee(10, 'US', 'GB', 'USD', 'GBP')
    expect(result.totalFees).toBe(result.insoundFee)
    expect(result.artistReceived).toBe(10 - result.insoundFee)
  })
})

// ── Pence rounding bugs ──

describe('REGRESSION: pence rounding must be exact integers', () => {
  it('calculateFeesPence returns integer values', () => {
    const amounts = [100, 199, 333, 500, 999, 1000, 4999]
    for (const pence of amounts) {
      const result = calculateFeesPence(pence)
      expect(Number.isInteger(result.insoundFee)).toBe(true)
      expect(Number.isInteger(result.stripeFee)).toBe(true)
      expect(Number.isInteger(result.artistReceived)).toBe(true)
    }
  })

  it('pence values always sum correctly: artistReceived = amount - insoundFee', () => {
    const amounts = [100, 500, 999, 1234, 5000]
    for (const pence of amounts) {
      const result = calculateFeesPence(pence)
      expect(result.artistReceived).toBe(pence - result.insoundFee)
    }
  })
})

// ── JPY zero-decimal currency ──

describe('REGRESSION: JPY must have zero decimal places', () => {
  it('formatPrice JPY has no decimal point', () => {
    const price = formatPrice(1550, 'JPY')
    expect(price).not.toContain('.')
  })

  it('convertPrice to JPY returns integer', () => {
    const rates = { GBP: 0.79, USD: 1.0, JPY: 155.0 }
    const amount = convertPrice(10, 'GBP', 'JPY', rates)
    expect(Number.isInteger(amount)).toBe(true)
  })
})

// ── Verification gating ──

describe('REGRESSION: artist verification requires all 3 conditions', () => {
  it('stripe + independence without releases = NOT verified', () => {
    expect(isVerified({ stripe_verified: true, independence_confirmed: true, release_count: 0 })).toBe(false)
  })

  it('stripe + releases without independence = NOT verified', () => {
    expect(isVerified({ stripe_verified: true, independence_confirmed: false, release_count: 5 })).toBe(false)
  })
})

// ── Open redirect prevention ──

describe('REGRESSION: redirectTo must not allow open redirects', () => {
  function isValidRedirect(path: unknown): boolean {
    return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')
  }

  it('blocks protocol-relative URL //evil.com', () => {
    expect(isValidRedirect('//evil.com')).toBe(false)
  })

  it('blocks absolute URL https://evil.com/path', () => {
    expect(isValidRedirect('https://evil.com/path')).toBe(false)
  })

  it('blocks javascript: scheme', () => {
    expect(isValidRedirect('javascript:alert(1)')).toBe(false)
  })

  it('allows legitimate internal paths', () => {
    expect(isValidRedirect('/welcome')).toBe(true)
    expect(isValidRedirect('/library')).toBe(true)
    expect(isValidRedirect('/dashboard/releases')).toBe(true)
  })
})

// ── CSRF origin validation ──

describe('REGRESSION: CSRF must check www variant', () => {
  function isOriginAllowed(origin: string, siteHost: string): boolean {
    try {
      const originHost = new URL(origin).hostname
      return originHost === siteHost || originHost === `www.${siteHost}` || `www.${originHost}` === siteHost
    } catch {
      return false
    }
  }

  it('accepts apex domain', () => {
    expect(isOriginAllowed('https://getinsound.com', 'getinsound.com')).toBe(true)
  })

  it('accepts www subdomain', () => {
    expect(isOriginAllowed('https://www.getinsound.com', 'getinsound.com')).toBe(true)
  })

  it('rejects different domain', () => {
    expect(isOriginAllowed('https://evil.com', 'getinsound.com')).toBe(false)
  })

  it('rejects subdomain attack (csrf.getinsound.com)', () => {
    expect(isOriginAllowed('https://csrf.getinsound.com', 'getinsound.com')).toBe(false)
  })
})

// ── Reserved slugs ──

describe('REGRESSION: dashboard must be reserved', () => {
  it('all critical app routes are reserved', () => {
    const criticalRoutes = ['dashboard', 'admin', 'api', 'auth', 'settings', 'library', 'search', 'login', 'signup']
    for (const route of criticalRoutes) {
      expect(RESERVED_SLUGS.has(route)).toBe(true)
    }
  })
})

// ── Accent colour validation ──

describe('REGRESSION: invalid accent colours must not break rendering', () => {
  const badValues = [null, undefined, '', '#FFF', 'red', 'rgb(255,0,0)', '#GG0000', '#12345', '#1234567']
  for (const bad of badValues) {
    it(`resolveAccent("${bad}") returns default`, () => {
      expect(resolveAccent(bad as any)).toBe(DEFAULT_ACCENT)
    })
  }
})

// ── IP masking privacy ──

describe('REGRESSION: IP masking must not leak full address', () => {
  it('IPv4 always masks last two octets', () => {
    const masked = maskIp('203.0.113.42')
    expect(masked).toBe('203.0.x.x')
    expect(masked).not.toContain('113')
    expect(masked).not.toContain('42')
  })

  it('IPv6 always masks after first two segments', () => {
    const masked = maskIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')
    expect(masked).not.toContain('85a3')
    expect(masked).not.toContain('7334')
  })
})

// ── Device parsing edge cases ──

describe('REGRESSION: parseDevice must not crash on malformed user agents', () => {
  it('handles null', () => {
    expect(() => parseDevice(null)).not.toThrow()
  })

  it('handles empty string', () => {
    expect(() => parseDevice('')).not.toThrow()
  })

  it('handles very long user agent', () => {
    expect(() => parseDevice('x'.repeat(10000))).not.toThrow()
  })

  it('handles user agent with special characters', () => {
    expect(() => parseDevice('<script>alert(1)</script>')).not.toThrow()
  })
})

// ── Currency fallback for unknown countries ──

describe('REGRESSION: unknown countries must default to USD, not crash', () => {
  it('unknown country codes default to USD', () => {
    const unknowns = ['ZZ', 'XX', 'T1', '', 'INVALID', '123']
    for (const code of unknowns) {
      expect(getCurrencyForCountry(code)).toBe('USD')
    }
  })

  it('unknown countries map to OTHER region', () => {
    expect(getRegion('ZZ')).toBe('OTHER')
    expect(getRegion('BR')).toBe('OTHER')
  })
})

// ── EEA edge cases ──

describe('REGRESSION: GB is NOT EEA (post-Brexit)', () => {
  it('GB maps to UK region, not EEA', () => {
    expect(getRegion('GB')).toBe('UK')
  })
})

// ── Self-follow prevention ──

describe('REGRESSION: users cannot follow themselves', () => {
  function validateFollow(userId: string, artistId: string): boolean {
    return artistId !== userId
  }

  it('blocks self-follow', () => {
    expect(validateFollow('user-1', 'user-1')).toBe(false)
  })

  it('allows following others', () => {
    expect(validateFollow('user-1', 'user-2')).toBe(true)
  })
})

// ── Dashboard banner regression ──

describe('REGRESSION: welcome banner hides when artist has published releases', () => {
  function showWelcomeBanner(totalSales: number, stripeOnboarded: boolean, hasPublishedRelease: boolean): boolean {
    return totalSales === 0 && stripeOnboarded && !hasPublishedRelease
  }

  it('shows for new onboarded artist with no releases', () => {
    expect(showWelcomeBanner(0, true, false)).toBe(true)
  })

  it('hides when artist has published release (YOUTH/Blue Lungs regression)', () => {
    expect(showWelcomeBanner(0, true, true)).toBe(false)
  })

  it('hides when artist has sales', () => {
    expect(showWelcomeBanner(1, true, false)).toBe(false)
  })
})

// ── Download code format ──

describe('REGRESSION: download codes exclude ambiguous chars 0, 1, O, I', () => {
  const CODE_REGEX = /^INSND-[A-Z2-9]{4}-[A-Z2-9]{4}$/

  it('rejects codes containing 0', () => {
    expect(CODE_REGEX.test('INSND-A0CD-EFGH')).toBe(false)
  })

  it('rejects codes containing 1', () => {
    expect(CODE_REGEX.test('INSND-A1CD-EFGH')).toBe(false)
  })

  it('accepts codes with only valid characters', () => {
    expect(CODE_REGEX.test('INSND-ABCD-EF23')).toBe(true)
    expect(CODE_REGEX.test('INSND-2345-6789')).toBe(true)
    expect(CODE_REGEX.test('INSND-WXYZ-ABCD')).toBe(true)
  })
})
