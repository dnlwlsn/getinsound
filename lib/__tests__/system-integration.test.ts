// System integration tests: cross-module flows combining multiple units

import { calculateStripeFee, calculateMerchFees, INSOUND_RATE } from '@/app/lib/fees'
import { getCurrencyForCountry, getRegion, isEEACountry, formatPrice, convertPrice } from '@/app/lib/currency'
import { isVerified } from '@/lib/verification'
import { resolveAccent, DEFAULT_ACCENT } from '@/lib/accent'
import { RESERVED_SLUGS } from '@/lib/reserved-slugs'
import { SOUNDS_SET } from '@/lib/sounds'
import { getTrackingUrl } from '@/lib/carriers'
import { generateGradient } from '@/lib/gradient'

// ── Fee + Currency integration ──

describe('fee calculation with country-to-currency mapping', () => {
  it('UK fan buying from UK artist — no surcharges', () => {
    const fanCountry = 'GB'
    const artistCountry = 'GB'
    const fanCurrency = getCurrencyForCountry(fanCountry)
    const artistCurrency = getCurrencyForCountry(artistCountry)

    const result = calculateStripeFee(10, fanCountry, artistCountry, fanCurrency, artistCurrency)
    expect(result.internationalFee).toBe(0)
    expect(result.conversionFee).toBe(0)
    expect(result.artistReceived).toBe(9)
  })

  it('US fan buying from UK artist — international + conversion', () => {
    const fanCountry = 'US'
    const artistCountry = 'GB'
    const fanCurrency = getCurrencyForCountry(fanCountry)
    const artistCurrency = getCurrencyForCountry(artistCountry)

    expect(fanCurrency).toBe('USD')
    expect(artistCurrency).toBe('GBP')

    const result = calculateStripeFee(10, fanCountry, artistCountry, fanCurrency, artistCurrency)
    expect(result.internationalFee).toBeGreaterThan(0)
    expect(result.conversionFee).toBeGreaterThan(0)
  })

  it('French fan buying from German artist — same region, same currency, no surcharges', () => {
    const fanCountry = 'FR'
    const artistCountry = 'DE'
    const fanCurrency = getCurrencyForCountry(fanCountry)
    const artistCurrency = getCurrencyForCountry(artistCountry)

    expect(fanCurrency).toBe('EUR')
    expect(artistCurrency).toBe('EUR')
    expect(getRegion(fanCountry)).toBe('EEA')
    expect(getRegion(artistCountry)).toBe('EEA')

    const result = calculateStripeFee(10, fanCountry, artistCountry, fanCurrency, artistCurrency)
    expect(result.internationalFee).toBe(0)
    expect(result.conversionFee).toBe(0)
  })

  it('Japanese fan buying from UK artist — OTHER→UK, different currencies', () => {
    const fanCountry = 'JP'
    const artistCountry = 'GB'
    const fanCurrency = getCurrencyForCountry(fanCountry)
    const artistCurrency = getCurrencyForCountry(artistCountry)

    expect(fanCurrency).toBe('JPY')
    expect(getRegion(fanCountry)).toBe('OTHER')

    const result = calculateStripeFee(1000, fanCountry, artistCountry, fanCurrency, artistCurrency)
    expect(result.internationalFee).toBeGreaterThan(0)
    expect(result.conversionFee).toBeGreaterThan(0)
  })
})

describe('merch fees with currency detection', () => {
  it('calculates merch order for Australian fan + UK artist', () => {
    const fanCurrency = getCurrencyForCountry('AU')
    const artistCurrency = getCurrencyForCountry('GB')
    expect(fanCurrency).toBe('AUD')

    const result = calculateMerchFees(25, 5, 'AU', 'GB', fanCurrency, artistCurrency)
    expect(result.totalCharged).toBe(30)
    expect(result.insoundFee).toBe(2.50)
    expect(result.artistReceives).toBe(27.50)
    expect(result.stripeFee).toBeGreaterThan(0)
  })
})

// ── Verification + search badge integration ──

describe('artist verification badge in search', () => {
  it('verified artist has all 3 conditions', () => {
    const artist = { stripe_verified: true, independence_confirmed: true, release_count: 2 }
    expect(isVerified(artist)).toBe(true)
  })

  it('new artist is not verified', () => {
    const artist = { stripe_verified: false, independence_confirmed: false, release_count: 0 }
    expect(isVerified(artist)).toBe(false)
  })

  it('artist with Stripe but no releases is not verified', () => {
    const artist = { stripe_verified: true, independence_confirmed: true, release_count: 0 }
    expect(isVerified(artist)).toBe(false)
  })
})

// ── Accent colour resolution in gradient context ──

describe('accent colour + gradient integration', () => {
  it('artist with custom accent gets their colour', () => {
    const colour = resolveAccent('#1a2b3c')
    expect(colour).toBe('#1a2b3c')
  })

  it('artist without accent falls back to default', () => {
    const colour = resolveAccent(null)
    expect(colour).toBe(DEFAULT_ACCENT)
  })

  it('gradient is generated for any artist+release combination', () => {
    const gradient = generateGradient('artist-uuid', 'release-uuid')
    expect(gradient.colours.length).toBeGreaterThanOrEqual(2)
    expect(gradient.css).toBeTruthy()
  })
})

// ── Slug reservation + genre validation ──

describe('artist onboarding validation', () => {
  it('rejects reserved slugs during registration', () => {
    const attemptedSlug = 'dashboard'
    expect(RESERVED_SLUGS.has(attemptedSlug)).toBe(true)
  })

  it('allows unique artist slugs', () => {
    expect(RESERVED_SLUGS.has('cool-band-name')).toBe(false)
  })

  it('validates genre selection against SOUNDS_SET', () => {
    const selectedGenres = ['Indie', 'Folk', 'Jazz']
    const allValid = selectedGenres.every(g => SOUNDS_SET.has(g))
    expect(allValid).toBe(true)
  })

  it('rejects invalid genre in selection', () => {
    const selectedGenres = ['Indie', 'Folk', 'Dubstep']
    const allValid = selectedGenres.every(g => SOUNDS_SET.has(g))
    expect(allValid).toBe(false)
  })
})

// ── Price display for different countries ──

describe('price display integration', () => {
  const rates = { GBP: 0.79, USD: 1.0, EUR: 0.92, JPY: 155.0, CAD: 1.37, AUD: 1.55 }

  it('UK user sees GBP price as-is', () => {
    const country = 'GB'
    const currency = getCurrencyForCountry(country)
    const price = formatPrice(10, currency)
    expect(price).toBe('£10.00')
  })

  it('Japanese user sees converted JPY with no decimals', () => {
    const country = 'JP'
    const currency = getCurrencyForCountry(country)
    const convertedAmount = convertPrice(10, 'GBP', currency, rates)
    const price = formatPrice(convertedAmount, currency)
    expect(Number.isInteger(convertedAmount)).toBe(true)
    expect(price).not.toContain('.')
  })

  it('Canadian user sees converted CAD with 2 decimals', () => {
    const country = 'CA'
    const currency = getCurrencyForCountry(country)
    const convertedAmount = convertPrice(10, 'GBP', currency, rates)
    const price = formatPrice(convertedAmount, currency, 'en-CA')
    expect(price).toContain('$')
  })
})

// ── Merch tracking integration ──

describe('order dispatch tracking', () => {
  it('Royal Mail tracking generates clickable URL', () => {
    const url = getTrackingUrl('royal_mail', 'AB123456789GB')
    expect(url).toContain('royalmail.com')
    expect(url).toContain('AB123456789GB')
  })

  it('unknown carrier returns null (no broken links)', () => {
    const url = getTrackingUrl('other', 'TRACK123')
    expect(url).toBeNull()
  })
})

// ── EEA country detection + region mapping end-to-end ──

describe('EEA region detection pipeline', () => {
  const eeaCountries = ['DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'NO', 'PL']
  for (const country of eeaCountries) {
    it(`${country} → EEA region → EUR or local currency`, () => {
      expect(isEEACountry(country)).toBe(true)
      expect(getRegion(country)).toBe('EEA')
    })
  }
})

// ── Full purchase flow fee consistency ──

describe('purchase flow fee consistency', () => {
  it('artist always receives exactly (1 - INSOUND_RATE) × amount', () => {
    const amounts = [0.50, 1, 5, 10, 50, 100]
    const scenarios = [
      { fan: 'GB', artist: 'GB' },
      { fan: 'US', artist: 'US' },
      { fan: 'DE', artist: 'DE' },
      { fan: 'US', artist: 'GB' },
      { fan: 'JP', artist: 'DE' },
    ]

    for (const amount of amounts) {
      for (const s of scenarios) {
        const fanCurrency = getCurrencyForCountry(s.fan)
        const artistCurrency = getCurrencyForCountry(s.artist)
        const result = calculateStripeFee(amount, s.fan, s.artist, fanCurrency, artistCurrency)

        const expectedArtistShare = Math.round((amount * (1 - INSOUND_RATE)) * 100) / 100
        expect(result.artistReceived).toBeCloseTo(expectedArtistShare, 2)
        expect(result.totalFees).toBeCloseTo(result.insoundFee, 2)
      }
    }
  })

  it('merch: insound fee applies only to item price, never postage', () => {
    const result = calculateMerchFees(10, 100, 'GB', 'GB', 'GBP', 'GBP')
    expect(result.insoundFee).toBe(1)
    expect(result.artistReceives).toBe(109)
  })
})
