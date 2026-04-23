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
  const totalFees = round2(stripeFee + internationalFee + conversionFee + insoundFee)
  const artistReceived = round2(amount - totalFees)

  return { stripeFee, internationalFee, conversionFee, insoundFee, artistReceived, totalFees }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Backward-compatible wrappers
export const STRIPE_RATE = 0.015
export const STRIPE_FIXED = 0.20

export function calculateFees(salePrice: number, zeroFees = false) {
  const result = calculateStripeFee(salePrice, 'GB', 'GB', 'GBP', 'GBP')
  return {
    insoundFee: zeroFees ? 0 : result.insoundFee,
    stripeFee: round2(result.stripeFee + result.internationalFee + result.conversionFee),
    artistReceived: zeroFees
      ? round2(salePrice - round2(result.stripeFee + result.internationalFee + result.conversionFee))
      : result.artistReceived,
  }
}

export function calculateFeesPence(amountPence: number, zeroFees = false) {
  const result = calculateStripeFee(amountPence / 100, 'GB', 'GB', 'GBP', 'GBP')
  const stripePence = Math.round((result.stripeFee + result.internationalFee + result.conversionFee) * 100)
  const insoundPence = zeroFees ? 0 : Math.round(result.insoundFee * 100)
  return {
    insoundFee: insoundPence,
    stripeFee: stripePence,
    artistReceived: amountPence - insoundPence - stripePence,
  }
}

export function isZeroFeesActive(
  hasZeroFees: boolean,
  startDate: string | null,
): { active: boolean; monthsRemaining: number | null } {
  if (!hasZeroFees) return { active: false, monthsRemaining: null }
  if (!startDate) return { active: true, monthsRemaining: 12 }

  const start = new Date(startDate)
  const expiry = new Date(start)
  expiry.setFullYear(expiry.getFullYear() + 1)
  const now = new Date()

  if (now >= expiry) return { active: false, monthsRemaining: 0 }

  const msRemaining = expiry.getTime() - now.getTime()
  const monthsRemaining = Math.ceil(msRemaining / (30 * 24 * 60 * 60 * 1000))
  return { active: true, monthsRemaining }
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

  const artistReceives = round2(totalCharged - insoundFee - stripeFee)

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
    totalCharged: Math.round(result.totalCharged * 100),
  }
}
