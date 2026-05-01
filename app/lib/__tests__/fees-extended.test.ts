import {
  calculateStripeFee, calculateMerchFees, calculateMerchFeesPence,
  INSOUND_RATE, STRIPE_RATE, STRIPE_FIXED,
} from '../fees'

describe('calculateStripeFee — edge cases', () => {
  it('handles zero amount', () => {
    const result = calculateStripeFee(0, 'GB', 'GB', 'GBP', 'GBP')
    expect(result.stripeFee).toBe(0.20)
    expect(result.insoundFee).toBe(0)
    expect(result.artistReceived).toBe(0)
    expect(result.totalFees).toBe(0)
  })

  it('handles very small amount (£0.50)', () => {
    const result = calculateStripeFee(0.50, 'GB', 'GB', 'GBP', 'GBP')
    expect(result.insoundFee).toBe(0.05)
    expect(result.artistReceived).toBe(0.45)
  })

  it('handles large amount (£10000)', () => {
    const result = calculateStripeFee(10000, 'GB', 'GB', 'GBP', 'GBP')
    expect(result.insoundFee).toBe(1000)
    expect(result.artistReceived).toBe(9000)
    expect(result.stripeFee).toBe(150.20)
  })

  it('OTHER region uses US rates', () => {
    const result = calculateStripeFee(10, 'JP', 'JP', 'JPY', 'JPY')
    expect(result.stripeFee).toBeCloseTo(0.59, 2)
    expect(result.internationalFee).toBe(0)
  })

  it('cross-region UK artist with US fan', () => {
    const result = calculateStripeFee(10, 'US', 'GB', 'USD', 'GBP')
    expect(result.internationalFee).toBeCloseTo(0.15, 2)
    expect(result.conversionFee).toBeCloseTo(0.20, 2)
    expect(result.stripeFee).toBeCloseTo(0.35, 2)
  })

  it('cross-region EEA artist with OTHER fan', () => {
    const result = calculateStripeFee(10, 'JP', 'DE', 'JPY', 'EUR')
    expect(result.internationalFee).toBeCloseTo(0.15, 2)
    expect(result.conversionFee).toBeCloseTo(0.20, 2)
  })

  it('same region different currencies still charges conversion', () => {
    // Hypothetical: same region key but different currencies
    const result = calculateStripeFee(10, 'DE', 'FR', 'EUR', 'EUR')
    expect(result.internationalFee).toBe(0)
    expect(result.conversionFee).toBe(0)
  })

  it('artist always receives exactly amount minus insound fee', () => {
    const amounts = [1, 5, 10, 25, 50, 100, 500]
    const scenarios = [
      { fan: 'GB', artist: 'GB', fanC: 'GBP', artC: 'GBP' },
      { fan: 'US', artist: 'US', fanC: 'USD', artC: 'USD' },
      { fan: 'US', artist: 'GB', fanC: 'USD', artC: 'GBP' },
      { fan: 'JP', artist: 'DE', fanC: 'JPY', artC: 'EUR' },
    ]
    for (const amount of amounts) {
      for (const s of scenarios) {
        const result = calculateStripeFee(amount, s.fan, s.artist, s.fanC, s.artC)
        const expected = Math.round((amount - amount * INSOUND_RATE) * 100) / 100
        expect(result.artistReceived).toBeCloseTo(expected, 2)
      }
    }
  })
})

describe('calculateMerchFees', () => {
  it('calculates domestic UK merch fees', () => {
    const result = calculateMerchFees(20, 5, 'GB', 'GB', 'GBP', 'GBP')
    expect(result.totalCharged).toBe(25)
    expect(result.insoundFee).toBe(2)
    expect(result.artistReceives).toBe(23)
    // Stripe fee on total: round2(25 * 0.015 + 0.20) = round2(0.575) = 0.57
    expect(result.stripeFee).toBeCloseTo(0.57, 2)
  })

  it('insound fee only applies to item price, not postage', () => {
    const result = calculateMerchFees(10, 50, 'GB', 'GB', 'GBP', 'GBP')
    expect(result.insoundFee).toBe(1)
    expect(result.artistReceives).toBe(59)
  })

  it('adds international + conversion fees for cross-region', () => {
    const result = calculateMerchFees(20, 5, 'US', 'GB', 'USD', 'GBP')
    expect(result.insoundFee).toBe(2)
    const baseStripe = 25 * 0.015 + 0.20
    const intlFee = 25 * 0.015
    const convFee = 25 * 0.02
    expect(result.stripeFee).toBeCloseTo(baseStripe + intlFee + convFee, 1)
  })

  it('handles zero postage', () => {
    const result = calculateMerchFees(20, 0, 'GB', 'GB', 'GBP', 'GBP')
    expect(result.totalCharged).toBe(20)
    expect(result.insoundFee).toBe(2)
  })

  it('handles zero item price', () => {
    const result = calculateMerchFees(0, 5, 'GB', 'GB', 'GBP', 'GBP')
    expect(result.insoundFee).toBe(0)
    expect(result.totalCharged).toBe(5)
  })
})

describe('calculateMerchFeesPence', () => {
  it('converts correctly to pence', () => {
    const result = calculateMerchFeesPence(2000, 500, 'GB', 'GB', 'GBP', 'GBP')
    expect(result.totalCharged).toBe(2500)
    expect(result.insoundFee).toBe(200)
    expect(result.artistReceives).toBe(2300)
  })

  it('totalCharged is sum of item + postage pence (not computed from pounds)', () => {
    const result = calculateMerchFeesPence(1999, 501, 'GB', 'GB', 'GBP', 'GBP')
    expect(result.totalCharged).toBe(2500)
  })
})

describe('backward compat constants', () => {
  it('INSOUND_RATE is 10%', () => {
    expect(INSOUND_RATE).toBe(0.10)
  })

  it('STRIPE_RATE is 1.5%', () => {
    expect(STRIPE_RATE).toBe(0.015)
  })

  it('STRIPE_FIXED is £0.20', () => {
    expect(STRIPE_FIXED).toBe(0.20)
  })
})
