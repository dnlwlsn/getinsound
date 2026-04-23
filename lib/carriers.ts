export const CARRIERS = [
  { value: 'royal_mail', label: 'Royal Mail' },
  { value: 'evri', label: 'Evri' },
  { value: 'dpd', label: 'DPD' },
  { value: 'yodel', label: 'Yodel' },
  { value: 'other', label: 'Other' },
] as const

export type CarrierCode = typeof CARRIERS[number]['value']

const TRACKING_URLS: Record<string, string> = {
  royal_mail: 'https://www.royalmail.com/track-your-item#/tracking-results/',
  evri: 'https://www.evri.com/track/parcel/',
  dpd: 'https://track.dpd.co.uk/parcels/',
  yodel: 'https://www.yodel.co.uk/tracking/',
}

export function getTrackingUrl(carrier: string | null, trackingNumber: string | null): string | null {
  if (!carrier || !trackingNumber) return null
  const base = TRACKING_URLS[carrier]
  if (!base) return null
  return base + encodeURIComponent(trackingNumber)
}
