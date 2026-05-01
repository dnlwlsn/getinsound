import { resolveAccent, accentStyle, DEFAULT_ACCENT } from '../accent'

describe('resolveAccent', () => {
  it('returns the colour when valid 6-digit hex', () => {
    expect(resolveAccent('#FF6600')).toBe('#FF6600')
  })

  it('returns default for null', () => {
    expect(resolveAccent(null)).toBe(DEFAULT_ACCENT)
  })

  it('returns default for undefined', () => {
    expect(resolveAccent(undefined)).toBe(DEFAULT_ACCENT)
  })

  it('returns default for empty string', () => {
    expect(resolveAccent('')).toBe(DEFAULT_ACCENT)
  })

  it('returns default for 3-digit hex shorthand', () => {
    expect(resolveAccent('#F60')).toBe(DEFAULT_ACCENT)
  })

  it('returns default for hex without #', () => {
    expect(resolveAccent('FF6600')).toBe(DEFAULT_ACCENT)
  })

  it('returns default for 8-digit hex with alpha', () => {
    expect(resolveAccent('#FF660080')).toBe(DEFAULT_ACCENT)
  })

  it('returns default for non-hex characters', () => {
    expect(resolveAccent('#ZZZZZZ')).toBe(DEFAULT_ACCENT)
  })

  it('accepts lowercase hex', () => {
    expect(resolveAccent('#ff6600')).toBe('#ff6600')
  })

  it('accepts mixed case hex', () => {
    expect(resolveAccent('#aAbBcC')).toBe('#aAbBcC')
  })
})

describe('accentStyle', () => {
  it('returns CSS variable object with resolved colour', () => {
    expect(accentStyle('#123456')).toEqual({ '--artist-accent': '#123456' })
  })

  it('uses default when null', () => {
    expect(accentStyle(null)).toEqual({ '--artist-accent': DEFAULT_ACCENT })
  })
})

describe('DEFAULT_ACCENT', () => {
  it('is Insound orange', () => {
    expect(DEFAULT_ACCENT).toBe('#F56D00')
  })
})
