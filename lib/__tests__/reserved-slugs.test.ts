import { RESERVED_SLUGS } from '../reserved-slugs'

describe('RESERVED_SLUGS', () => {
  it('is a Set', () => {
    expect(RESERVED_SLUGS).toBeInstanceOf(Set)
  })

  it('reserves critical system paths', () => {
    expect(RESERVED_SLUGS.has('admin')).toBe(true)
    expect(RESERVED_SLUGS.has('api')).toBe(true)
    expect(RESERVED_SLUGS.has('auth')).toBe(true)
    expect(RESERVED_SLUGS.has('dashboard')).toBe(true)
    expect(RESERVED_SLUGS.has('settings')).toBe(true)
    expect(RESERVED_SLUGS.has('login')).toBe(true)
    expect(RESERVED_SLUGS.has('signup')).toBe(true)
  })

  it('reserves content paths', () => {
    expect(RESERVED_SLUGS.has('library')).toBe(true)
    expect(RESERVED_SLUGS.has('search')).toBe(true)
    expect(RESERVED_SLUGS.has('explore')).toBe(true)
    expect(RESERVED_SLUGS.has('discover')).toBe(true)
    expect(RESERVED_SLUGS.has('notifications')).toBe(true)
    expect(RESERVED_SLUGS.has('orders')).toBe(true)
  })

  it('reserves legal pages', () => {
    expect(RESERVED_SLUGS.has('privacy')).toBe(true)
    expect(RESERVED_SLUGS.has('terms')).toBe(true)
    expect(RESERVED_SLUGS.has('ai-policy')).toBe(true)
  })

  it('reserves Next.js infrastructure paths', () => {
    expect(RESERVED_SLUGS.has('_next')).toBe(true)
    expect(RESERVED_SLUGS.has('favicon-ico')).toBe(true)
    expect(RESERVED_SLUGS.has('robots-txt')).toBe(true)
    expect(RESERVED_SLUGS.has('sitemap-xml')).toBe(true)
  })

  it('does not reserve common artist-viable slugs', () => {
    expect(RESERVED_SLUGS.has('radiohead')).toBe(false)
    expect(RESERVED_SLUGS.has('my-band')).toBe(false)
    expect(RESERVED_SLUGS.has('john-doe')).toBe(false)
  })

  it('all entries are lowercase strings', () => {
    for (const slug of RESERVED_SLUGS) {
      expect(slug).toBe(slug.toLowerCase())
      expect(typeof slug).toBe('string')
      expect(slug.length).toBeGreaterThan(0)
    }
  })
})
