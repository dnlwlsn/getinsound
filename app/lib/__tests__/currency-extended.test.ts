import { isEEACountry, getRegion, convertPrice, formatPrice } from '../currency'

describe('isEEACountry', () => {
  it('recognises all eurozone countries as EEA', () => {
    const eurozone = ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'IE', 'PT', 'FI', 'GR', 'LU', 'MT', 'SK', 'SI', 'EE', 'LV', 'LT', 'CY']
    for (const code of eurozone) {
      expect(isEEACountry(code)).toBe(true)
    }
  })

  it('recognises non-eurozone EEA members', () => {
    expect(isEEACountry('NO')).toBe(true)
    expect(isEEACountry('IS')).toBe(true)
    expect(isEEACountry('LI')).toBe(true)
    expect(isEEACountry('SE')).toBe(true)
    expect(isEEACountry('DK')).toBe(true)
    expect(isEEACountry('PL')).toBe(true)
  })

  it('rejects non-EEA countries', () => {
    expect(isEEACountry('GB')).toBe(false)
    expect(isEEACountry('US')).toBe(false)
    expect(isEEACountry('JP')).toBe(false)
    expect(isEEACountry('AU')).toBe(false)
    expect(isEEACountry('CH')).toBe(false)
  })
})

describe('getRegion', () => {
  it('maps GB to UK', () => {
    expect(getRegion('GB')).toBe('UK')
  })

  it('maps US to US', () => {
    expect(getRegion('US')).toBe('US')
  })

  it('maps EEA countries to EEA', () => {
    expect(getRegion('DE')).toBe('EEA')
    expect(getRegion('FR')).toBe('EEA')
    expect(getRegion('NO')).toBe('EEA')
  })

  it('maps everything else to OTHER', () => {
    expect(getRegion('JP')).toBe('OTHER')
    expect(getRegion('AU')).toBe('OTHER')
    expect(getRegion('BR')).toBe('OTHER')
    expect(getRegion('CA')).toBe('OTHER')
  })
})

describe('convertPrice — edge cases', () => {
  const rates = { GBP: 0.79, USD: 1.0, EUR: 0.92, JPY: 155.0 }

  it('returns original amount when from currency has no rate', () => {
    expect(convertPrice(10, 'FAKE', 'USD', rates)).toBe(10)
  })

  it('returns original amount when to currency has no rate', () => {
    expect(convertPrice(10, 'USD', 'FAKE', rates)).toBe(10)
  })

  it('handles zero amount', () => {
    expect(convertPrice(0, 'GBP', 'USD', rates)).toBe(0)
  })

  it('rounds JPY to integer (zero-decimal)', () => {
    const result = convertPrice(1, 'USD', 'JPY', rates)
    expect(Number.isInteger(result)).toBe(true)
  })

  it('rounds non-JPY to 2 decimal places', () => {
    const result = convertPrice(1, 'JPY', 'GBP', rates)
    const decimals = result.toString().split('.')[1]?.length ?? 0
    expect(decimals).toBeLessThanOrEqual(2)
  })
})

describe('formatPrice — edge cases', () => {
  it('handles very large numbers', () => {
    const result = formatPrice(1000000, 'GBP')
    expect(result).toContain('1,000,000')
  })

  it('respects explicit locale override', () => {
    const result = formatPrice(10, 'EUR', 'fr-FR')
    expect(result).toContain('€')
  })
})
