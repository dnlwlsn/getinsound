import { formatPrice, convertPrice, getCurrencyForCountry, getLocaleTag, SUPPORTED_CURRENCIES } from '../currency'

describe('getCurrencyForCountry', () => {
  it('maps GB to GBP', () => {
    expect(getCurrencyForCountry('GB')).toBe('GBP')
  })
  it('maps US to USD', () => {
    expect(getCurrencyForCountry('US')).toBe('USD')
  })
  it('maps EU countries to EUR', () => {
    expect(getCurrencyForCountry('DE')).toBe('EUR')
    expect(getCurrencyForCountry('FR')).toBe('EUR')
    expect(getCurrencyForCountry('ES')).toBe('EUR')
    expect(getCurrencyForCountry('IT')).toBe('EUR')
    expect(getCurrencyForCountry('NL')).toBe('EUR')
    expect(getCurrencyForCountry('BE')).toBe('EUR')
    expect(getCurrencyForCountry('AT')).toBe('EUR')
    expect(getCurrencyForCountry('IE')).toBe('EUR')
    expect(getCurrencyForCountry('PT')).toBe('EUR')
    expect(getCurrencyForCountry('FI')).toBe('EUR')
    expect(getCurrencyForCountry('GR')).toBe('EUR')
    expect(getCurrencyForCountry('LU')).toBe('EUR')
    expect(getCurrencyForCountry('MT')).toBe('EUR')
    expect(getCurrencyForCountry('SK')).toBe('EUR')
    expect(getCurrencyForCountry('SI')).toBe('EUR')
    expect(getCurrencyForCountry('EE')).toBe('EUR')
    expect(getCurrencyForCountry('LV')).toBe('EUR')
    expect(getCurrencyForCountry('LT')).toBe('EUR')
    expect(getCurrencyForCountry('CY')).toBe('EUR')
  })
  it('maps CA to CAD', () => {
    expect(getCurrencyForCountry('CA')).toBe('CAD')
  })
  it('maps AU to AUD', () => {
    expect(getCurrencyForCountry('AU')).toBe('AUD')
  })
  it('maps JP to JPY', () => {
    expect(getCurrencyForCountry('JP')).toBe('JPY')
  })
  it('defaults unknown countries to USD', () => {
    expect(getCurrencyForCountry('ZZ')).toBe('USD')
    expect(getCurrencyForCountry('BR')).toBe('USD')
    expect(getCurrencyForCountry('')).toBe('USD')
  })
})

describe('getLocaleTag', () => {
  it('maps country codes to BCP 47 locale tags', () => {
    expect(getLocaleTag('GB')).toBe('en-GB')
    expect(getLocaleTag('US')).toBe('en-US')
    expect(getLocaleTag('DE')).toBe('de-DE')
    expect(getLocaleTag('FR')).toBe('fr-FR')
    expect(getLocaleTag('JP')).toBe('ja-JP')
    expect(getLocaleTag('CA')).toBe('en-CA')
    expect(getLocaleTag('AU')).toBe('en-AU')
  })
  it('defaults unknown countries to en-US', () => {
    expect(getLocaleTag('ZZ')).toBe('en-US')
  })
})

describe('formatPrice', () => {
  it('formats GBP with £ symbol', () => {
    expect(formatPrice(10, 'GBP')).toBe('£10.00')
  })
  it('formats USD with $ symbol', () => {
    expect(formatPrice(10, 'USD')).toBe('$10.00')
  })
  it('formats EUR with € symbol', () => {
    const result = formatPrice(10, 'EUR')
    expect(result).toContain('€')
    expect(result).toContain('10')
  })
  it('formats JPY with no decimal places', () => {
    const result = formatPrice(1000, 'JPY')
    // Node's Intl may output narrow ¥ (U+00A5) or full-width ￥ (U+FFE5)
    expect(result).toMatch(/[¥￥]/)
    expect(result).not.toContain('.')
  })
  it('formats with locale-appropriate separators', () => {
    const result = formatPrice(1000, 'GBP', 'en-GB')
    expect(result).toContain('1,000')
  })
  it('handles zero', () => {
    expect(formatPrice(0, 'GBP')).toBe('£0.00')
  })
  it('handles negative values', () => {
    const result = formatPrice(-10, 'GBP')
    expect(result).toContain('10.00')
  })
})

describe('convertPrice', () => {
  const rates = { GBP: 0.79, USD: 1.0, EUR: 0.92, JPY: 155.0, CAD: 1.37, AUD: 1.55 }

  it('converts GBP to USD', () => {
    const result = convertPrice(10, 'GBP', 'USD', rates)
    expect(result).toBeCloseTo(12.66, 1)
  })
  it('converts USD to GBP', () => {
    const result = convertPrice(10, 'USD', 'GBP', rates)
    expect(result).toBeCloseTo(7.90, 1)
  })
  it('returns same amount when currencies match', () => {
    expect(convertPrice(10, 'GBP', 'GBP', rates)).toBe(10)
  })
  it('converts to JPY with 0 decimals', () => {
    const result = convertPrice(10, 'USD', 'JPY', rates)
    expect(result).toBe(1550)
  })
  it('converts between non-USD currencies via USD base', () => {
    const result = convertPrice(10, 'GBP', 'EUR', rates)
    expect(result).toBeCloseTo(11.65, 0)
  })
})

describe('SUPPORTED_CURRENCIES', () => {
  it('contains all 6 supported currencies with symbols', () => {
    expect(SUPPORTED_CURRENCIES).toHaveLength(6)
    const codes = SUPPORTED_CURRENCIES.map(c => c.code)
    expect(codes).toContain('GBP')
    expect(codes).toContain('USD')
    expect(codes).toContain('EUR')
    expect(codes).toContain('CAD')
    expect(codes).toContain('AUD')
    expect(codes).toContain('JPY')
  })
})
