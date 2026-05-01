import { isVerified, SOCIAL_PLATFORMS, getSocialIcon } from '../verification'

describe('isVerified', () => {
  it('returns true when all conditions met', () => {
    expect(isVerified({ stripe_verified: true, independence_confirmed: true, release_count: 1 })).toBe(true)
  })

  it('returns false when stripe not verified', () => {
    expect(isVerified({ stripe_verified: false, independence_confirmed: true, release_count: 1 })).toBe(false)
  })

  it('returns false when independence not confirmed', () => {
    expect(isVerified({ stripe_verified: true, independence_confirmed: false, release_count: 1 })).toBe(false)
  })

  it('returns false when no releases', () => {
    expect(isVerified({ stripe_verified: true, independence_confirmed: true, release_count: 0 })).toBe(false)
  })

  it('returns false when all conditions unmet', () => {
    expect(isVerified({ stripe_verified: false, independence_confirmed: false, release_count: 0 })).toBe(false)
  })

  it('returns true with many releases', () => {
    expect(isVerified({ stripe_verified: true, independence_confirmed: true, release_count: 50 })).toBe(true)
  })
})

describe('SOCIAL_PLATFORMS', () => {
  it('has 6 platforms', () => {
    expect(SOCIAL_PLATFORMS).toHaveLength(6)
  })

  it('has correct platform keys', () => {
    const keys = SOCIAL_PLATFORMS.map(p => p.key)
    expect(keys).toEqual(['instagram', 'twitter', 'spotify', 'soundcloud', 'youtube', 'website'])
  })

  describe('URL patterns', () => {
    const find = (key: string) => SOCIAL_PLATFORMS.find(p => p.key === key)!

    it('instagram validates correct URLs', () => {
      const p = find('instagram')
      expect(p.pattern.test('https://instagram.com/artist')).toBe(true)
      expect(p.pattern.test('https://www.instagram.com/artist')).toBe(true)
      expect(p.pattern.test('http://instagram.com/artist')).toBe(true)
      expect(p.pattern.test('https://facebook.com/artist')).toBe(false)
    })

    it('twitter/X validates both domains', () => {
      const p = find('twitter')
      expect(p.pattern.test('https://twitter.com/user')).toBe(true)
      expect(p.pattern.test('https://x.com/user')).toBe(true)
      expect(p.pattern.test('https://www.x.com/user')).toBe(true)
    })

    it('spotify validates artist URLs', () => {
      const p = find('spotify')
      expect(p.pattern.test('https://open.spotify.com/artist/abc123')).toBe(true)
      expect(p.pattern.test('https://open.spotify.com/track/abc123')).toBe(false)
    })

    it('soundcloud validates URLs', () => {
      const p = find('soundcloud')
      expect(p.pattern.test('https://soundcloud.com/artist')).toBe(true)
      expect(p.pattern.test('https://www.soundcloud.com/artist')).toBe(true)
    })

    it('youtube validates multiple URL formats', () => {
      const p = find('youtube')
      expect(p.pattern.test('https://youtube.com/@artist')).toBe(true)
      expect(p.pattern.test('https://www.youtube.com/channel/abc')).toBe(true)
    })

    it('website validates any domain', () => {
      const p = find('website')
      expect(p.pattern.test('https://mysite.com')).toBe(true)
      expect(p.pattern.test('http://my-band.co.uk')).toBe(true)
      expect(p.pattern.test('ftp://invalid')).toBe(false)
    })
  })
})

describe('getSocialIcon', () => {
  it('returns SVG path data for all platforms', () => {
    const platforms = ['instagram', 'twitter', 'spotify', 'soundcloud', 'youtube', 'website'] as const
    for (const p of platforms) {
      const icon = getSocialIcon(p)
      expect(typeof icon).toBe('string')
      expect(icon.length).toBeGreaterThan(10)
    }
  })
})
