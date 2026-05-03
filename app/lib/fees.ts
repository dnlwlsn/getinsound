import { getRegion } from './currency'

export const INSOUND_RATE = 0.10

const STRIPE_RATES: Record<string, { percent: number; fixed: number }> = {
  UK:    { percent: 0.015, fixed: 0.20 },
  EEA:   { percent: 0.015, fixed: 0.25 },
  US:    { percent: 0.029, fixed: 0.30 },
  OTHER: { percent: 0.029, fixed: 0.30 },
}

const INTERNATIONAL_SURCHARGE = 0.015
const CONVERSION_FEE_RATE = 0.02

export interface StripeFeeResult {
  stripeFee: number
  internationalFee: number
  conversionFee: number
  insoundFee: number
  artistReceived: number
  totalFees: number
}

export function calculateStripeFee(
  amount: number,
  fanRegion: string,
  artistRegion: string,
  fanCurrency: string,
  artistCurrency: string,
): StripeFeeResult {
  const artistRegionKey = getRegion(artistRegion)
  const fanRegionKey = getRegion(fanRegion)
  const rate = STRIPE_RATES[artistRegionKey]

  const stripeFee = round2(amount * rate.percent + rate.fixed)
  const internationalFee = fanRegionKey !== artistRegionKey
    ? round2(amount * INTERNATIONAL_SURCHARGE)
    : 0
  const conversionFee = fanCurrency !== artistCurrency
    ? round2(amount * CONVERSION_FEE_RATE)
    : 0
  const insoundFee = round2(amount * INSOUND_RATE)
  // Stripe fees come out of Insound's cut (destination charges), not the artist's share
  const artistReceived = round2(amount - insoundFee)
  const totalFees = round2(insoundFee)

  return { stripeFee, internationalFee, conversionFee, insoundFee, artistReceived, totalFees }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Backward-compatible wrappers
export const STRIPE_RATE = 0.015
export const STRIPE_FIXED = 0.20

export function calculateFees(salePrice: number) {
  const result = calculateStripeFee(salePrice, 'GB', 'GB', 'GBP', 'GBP')
  return {
    insoundFee: result.insoundFee,
    stripeFee: round2(result.stripeFee + result.internationalFee + result.conversionFee),
    artistReceived: result.artistReceived,
  }
}

export function calculateFeesPence(amountPence: number) {
  const result = calculateStripeFee(amountPence / 100, 'GB', 'GB', 'GBP', 'GBP')
  const stripePence = Math.round((result.stripeFee + result.internationalFee + result.conversionFee) * 100)
  const insoundPence = Math.round(result.insoundFee * 100)
  return {
    insoundFee: insoundPence,
    stripeFee: stripePence,
    artistReceived: amountPence - insoundPence,
  }
}

export function validatePriceProfitability(
  amountPence: number,
  fanRegion: string,
  artistRegion: string,
  fanCurrency: string,
  artistCurrency: string,
): { profitable: boolean; minimumPence: number } {
  const amount = amountPence / 100
  const result = calculateStripeFee(amount, fanRegion, artistRegion, fanCurrency, artistCurrency)
  const totalStripeCost = result.stripeFee + result.internationalFee + result.conversionFee
  const profitable = result.insoundFee >= totalStripeCost

  if (profitable) return { profitable: true, minimumPence: amountPence }

  // Binary search for minimum profitable price
  let low = amountPence
  let high = amountPence * 5
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    const midResult = calculateStripeFee(mid / 100, fanRegion, artistRegion, fanCurrency, artistCurrency)
    const midCost = midResult.stripeFee + midResult.internationalFee + midResult.conversionFee
    if (midResult.insoundFee >= midCost) {
      high = mid
    } else {
      low = mid + 1
    }
  }

  return { profitable: false, minimumPence: low }
}

export interface MerchFeeResult {
  insoundFee: number
  stripeFee: number
  artistReceives: number
  totalCharged: number
}

export function calculateMerchFees(
  itemPrice: number,
  postage: number,
  fanRegion: string,
  artistRegion: string,
  fanCurrency: string,
  artistCurrency: string,
): MerchFeeResult {
  const totalCharged = round2(itemPrice + postage)
  const insoundFee = round2(itemPrice * INSOUND_RATE)

  const artistRegionKey = getRegion(artistRegion)
  const fanRegionKey = getRegion(fanRegion)
  const rate = STRIPE_RATES[artistRegionKey]

  const baseStripeFee = round2(totalCharged * rate.percent + rate.fixed)
  const internationalFee = fanRegionKey !== artistRegionKey
    ? round2(totalCharged * INTERNATIONAL_SURCHARGE)
    : 0
  const conversionFee = fanCurrency !== artistCurrency
    ? round2(totalCharged * CONVERSION_FEE_RATE)
    : 0
  const stripeFee = round2(baseStripeFee + internationalFee + conversionFee)

  const artistReceives = round2(totalCharged - insoundFee)

  return { insoundFee, stripeFee, artistReceives, totalCharged }
}

export function calculateMerchFeesPence(
  itemPricePence: number,
  postagePence: number,
  fanRegion: string,
  artistRegion: string,
  fanCurrency: string,
  artistCurrency: string,
): { insoundFee: number; stripeFee: number; artistReceives: number; totalCharged: number } {
  const result = calculateMerchFees(
    itemPricePence / 100, postagePence / 100,
    fanRegion, artistRegion, fanCurrency, artistCurrency,
  )
  return {
    insoundFee: Math.round(result.insoundFee * 100),
    stripeFee: Math.round(result.stripeFee * 100),
    artistReceives: Math.round(result.artistReceives * 100),
    totalCharged: itemPricePence + postagePence,
  }
}
