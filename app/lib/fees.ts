export const INSOUND_RATE = 0.10
export const STRIPE_RATE = 0.015
export const STRIPE_FIXED = 0.20

export function calculateFees(salePrice: number) {
  const insoundFee = salePrice * INSOUND_RATE
  const stripeFee = salePrice * STRIPE_RATE + STRIPE_FIXED
  const artistReceived = salePrice - insoundFee - stripeFee
  return { insoundFee, stripeFee, artistReceived }
}

export function calculateFeesPence(amountPence: number) {
  const insoundFee = Math.round(amountPence * INSOUND_RATE)
  const stripeFee = Math.round(amountPence * STRIPE_RATE) + 20
  const artistReceived = amountPence - insoundFee - stripeFee
  return { insoundFee, stripeFee, artistReceived }
}
