import { calculateStripeFee, calculateFees, calculateFeesPence } from '../fees'

describe('calculateStripeFee', () => {
  it('calculates UK domestic fees correctly', () => {
    const result = calculateStripeFee(10, 'GB', 'GB', 'GBP', 'GBP')
    expect(result.stripeFee).toBeCloseTo(0.35, 2)
    expect(result.internationalFee).toBe(0)
    expect(result.conversionFee).toBe(0)
    expect(result.insoundFee).toBeCloseTo(1.0, 2)
    // Destination charges: artist gets amount minus insound fee only (Stripe fees from Insound's cut)
    expect(result.artistReceived).toBeCloseTo(9.0, 2)
  })

  it('calculates US domestic fees correctly', () => {
    const result = calculateStripeFee(10, 'US', 'US', 'USD', 'USD')
    expect(result.stripeFee).toBeCloseTo(0.59, 2)
    expect(result.internationalFee).toBe(0)
    expect(result.conversionFee).toBe(0)
    expect(result.insoundFee).toBeCloseTo(1.0, 2)
    expect(result.artistReceived).toBeCloseTo(9.0, 2)
  })

  it('calculates EEA domestic fees correctly', () => {
    const result = calculateStripeFee(10, 'DE', 'DE', 'EUR', 'EUR')
    expect(result.stripeFee).toBeCloseTo(0.40, 2)
    expect(result.internationalFee).toBe(0)
    expect(result.conversionFee).toBe(0)
    expect(result.insoundFee).toBeCloseTo(1.0, 2)
    expect(result.artistReceived).toBeCloseTo(9.0, 2)
  })

  it('adds international surcharge for cross-region', () => {
    const result = calculateStripeFee(10, 'US', 'GB', 'USD', 'GBP')
    expect(result.internationalFee).toBeCloseTo(0.15, 2)
    expect(result.conversionFee).toBeCloseTo(0.20, 2)
  })

  it('adds conversion fee when currencies differ', () => {
    const result = calculateStripeFee(10, 'DE', 'GB', 'EUR', 'GBP')
    expect(result.conversionFee).toBeCloseTo(0.20, 2)
  })

  it('no conversion fee when currencies match even if cross-region', () => {
    const result = calculateStripeFee(10, 'FR', 'DE', 'EUR', 'EUR')
    expect(result.conversionFee).toBe(0)
    expect(result.internationalFee).toBe(0)
  })

  it('totalFees equals insound fee (Stripe fees absorbed by platform)', () => {
    const result = calculateStripeFee(10, 'US', 'GB', 'USD', 'GBP')
    expect(result.totalFees).toBeCloseTo(result.insoundFee, 2)
  })

  it('artistReceived equals amount minus insound fee', () => {
    const result = calculateStripeFee(10, 'US', 'GB', 'USD', 'GBP')
    expect(result.artistReceived).toBeCloseTo(10 - result.insoundFee, 2)
  })
})

describe('calculateFees (backward compat)', () => {
  it('returns correct result for GBP domestic', () => {
    const result = calculateFees(10)
    expect(result.insoundFee).toBeCloseTo(1.0, 2)
    expect(result.stripeFee).toBeCloseTo(0.35, 2)
    expect(result.artistReceived).toBeCloseTo(9.0, 2)
  })
})

describe('calculateFeesPence (backward compat)', () => {
  it('returns correct result for GBP domestic in pence', () => {
    const result = calculateFeesPence(1000)
    expect(result.insoundFee).toBe(100)
    expect(result.stripeFee).toBe(35)
    expect(result.artistReceived).toBe(900)
  })
})
