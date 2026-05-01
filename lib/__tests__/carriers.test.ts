import { CARRIERS, getTrackingUrl } from '../carriers'

describe('CARRIERS', () => {
  it('contains 5 carriers', () => {
    expect(CARRIERS).toHaveLength(5)
  })

  it('includes expected carriers', () => {
    const values = CARRIERS.map(c => c.value)
    expect(values).toContain('royal_mail')
    expect(values).toContain('evri')
    expect(values).toContain('dpd')
    expect(values).toContain('yodel')
    expect(values).toContain('other')
  })
})

describe('getTrackingUrl', () => {
  it('builds Royal Mail URL with encoded tracking number', () => {
    expect(getTrackingUrl('royal_mail', 'AB123456789GB'))
      .toBe('https://www.royalmail.com/track-your-item#/tracking-results/AB123456789GB')
  })

  it('builds Evri URL', () => {
    expect(getTrackingUrl('evri', 'PARCEL123'))
      .toBe('https://www.evri.com/track/parcel/PARCEL123')
  })

  it('builds DPD URL', () => {
    expect(getTrackingUrl('dpd', 'DPD-001'))
      .toBe('https://track.dpd.co.uk/parcels/DPD-001')
  })

  it('builds Yodel URL', () => {
    expect(getTrackingUrl('yodel', 'YDL123'))
      .toBe('https://www.yodel.co.uk/tracking/YDL123')
  })

  it('returns null for "other" carrier (no URL template)', () => {
    expect(getTrackingUrl('other', 'TRACK123')).toBeNull()
  })

  it('returns null when carrier is null', () => {
    expect(getTrackingUrl(null, 'TRACK123')).toBeNull()
  })

  it('returns null when tracking number is null', () => {
    expect(getTrackingUrl('royal_mail', null)).toBeNull()
  })

  it('returns null when both are null', () => {
    expect(getTrackingUrl(null, null)).toBeNull()
  })

  it('encodes special characters in tracking number', () => {
    expect(getTrackingUrl('royal_mail', 'AB 123/456'))
      .toBe('https://www.royalmail.com/track-your-item#/tracking-results/AB%20123%2F456')
  })

  it('returns null for unknown carrier', () => {
    expect(getTrackingUrl('fedex', 'TRACK123')).toBeNull()
  })
})
