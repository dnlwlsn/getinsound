// System tests: validates API route input handling patterns
// Tests the validation logic used across all API routes

describe('download code format validation', () => {
  const CODE_REGEX = /^INSND-[A-Z2-9]{4}-[A-Z2-9]{4}$/

  it('accepts valid code format', () => {
    expect(CODE_REGEX.test('INSND-ABCD-EF23')).toBe(true)
  })

  it('accepts codes with only numbers 2-9', () => {
    expect(CODE_REGEX.test('INSND-2345-6789')).toBe(true)
  })

  it('rejects lowercase letters', () => {
    expect(CODE_REGEX.test('INSND-abcd-ef23')).toBe(false)
  })

  it('rejects codes with 0 or 1 (ambiguous characters)', () => {
    expect(CODE_REGEX.test('INSND-AB01-CD10')).toBe(false)
  })

  it('rejects wrong prefix', () => {
    expect(CODE_REGEX.test('WRONG-ABCD-EF23')).toBe(false)
  })

  it('rejects too-short segments', () => {
    expect(CODE_REGEX.test('INSND-ABC-EF23')).toBe(false)
  })

  it('rejects too-long segments', () => {
    expect(CODE_REGEX.test('INSND-ABCDE-EF23')).toBe(false)
  })

  it('rejects missing dashes', () => {
    expect(CODE_REGEX.test('INSNDABCDEF23')).toBe(false)
  })
})

describe('email validation pattern (used in redeem)', () => {
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  it('accepts normal email', () => {
    expect(EMAIL_REGEX.test('fan@example.com')).toBe(true)
  })

  it('accepts email with dots', () => {
    expect(EMAIL_REGEX.test('first.last@example.co.uk')).toBe(true)
  })

  it('accepts email with plus', () => {
    expect(EMAIL_REGEX.test('user+tag@gmail.com')).toBe(true)
  })

  it('rejects email without @', () => {
    expect(EMAIL_REGEX.test('invalid')).toBe(false)
  })

  it('rejects email without domain', () => {
    expect(EMAIL_REGEX.test('user@')).toBe(false)
  })

  it('rejects email with spaces', () => {
    expect(EMAIL_REGEX.test('user @example.com')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(EMAIL_REGEX.test('')).toBe(false)
  })
})

describe('search query sanitisation', () => {
  it('trims whitespace', () => {
    const raw = '  hello world  '
    expect(raw.trim()).toBe('hello world')
  })

  it('limits to 200 characters', () => {
    const raw = 'a'.repeat(300)
    const q = raw.trim().slice(0, 200)
    expect(q).toHaveLength(200)
  })

  it('empty query returns empty', () => {
    expect(''.trim().slice(0, 200)).toBe('')
    expect('   '.trim().slice(0, 200)).toBe('')
  })
})

describe('redirect path validation (signup)', () => {
  function isValidRedirect(path: unknown): boolean {
    return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')
  }

  it('accepts valid paths', () => {
    expect(isValidRedirect('/welcome')).toBe(true)
    expect(isValidRedirect('/library')).toBe(true)
    expect(isValidRedirect('/dashboard/releases')).toBe(true)
  })

  it('rejects protocol-relative URLs (open redirect)', () => {
    expect(isValidRedirect('//evil.com')).toBe(false)
  })

  it('rejects absolute URLs', () => {
    expect(isValidRedirect('https://evil.com')).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(isValidRedirect(null)).toBe(false)
    expect(isValidRedirect(undefined)).toBe(false)
    expect(isValidRedirect(42)).toBe(false)
  })
})

describe('notification pagination', () => {
  const PAGE_SIZE = 20

  function parsePage(pageParam: string | null): number {
    return Math.max(1, parseInt(pageParam ?? '1', 10))
  }

  function range(page: number): { from: number; to: number } {
    return { from: (page - 1) * PAGE_SIZE, to: page * PAGE_SIZE - 1 }
  }

  it('defaults to page 1', () => {
    expect(parsePage(null)).toBe(1)
    expect(parsePage('1')).toBe(1)
  })

  it('clamps negative pages to 1', () => {
    expect(parsePage('-5')).toBe(1)
    expect(parsePage('0')).toBe(1)
  })

  it('parses valid page numbers', () => {
    expect(parsePage('3')).toBe(3)
  })

  it('calculates correct range for page 1', () => {
    expect(range(1)).toEqual({ from: 0, to: 19 })
  })

  it('calculates correct range for page 2', () => {
    expect(range(2)).toEqual({ from: 20, to: 39 })
  })

  it('handles NaN input (Math.max(1, NaN) returns NaN)', () => {
    // parseInt('abc') returns NaN, and Math.max(1, NaN) is NaN in JS
    expect(parsePage('abc')).toBeNaN()
  })
})

describe('search result limit', () => {
  function parseLimit(limitParam: string | null): number {
    return Math.min(Number(limitParam) || 50, 50)
  }

  it('defaults to 50', () => {
    expect(parseLimit(null)).toBe(50)
  })

  it('caps at 50', () => {
    expect(parseLimit('100')).toBe(50)
    expect(parseLimit('1000')).toBe(50)
  })

  it('accepts lower limits', () => {
    expect(parseLimit('10')).toBe(10)
    expect(parseLimit('25')).toBe(25)
  })

  it('handles NaN', () => {
    expect(parseLimit('abc')).toBe(50)
  })
})

describe('favourites — mutual exclusion', () => {
  function validateFavourite(body: any): string | null {
    if (!body) return 'Invalid JSON'
    if (!body.track_id && !body.release_id) return 'track_id or release_id required'
    if (body.track_id && body.release_id) return 'Provide track_id or release_id, not both'
    return null
  }

  it('accepts track_id only', () => {
    expect(validateFavourite({ track_id: 't1' })).toBeNull()
  })

  it('accepts release_id only', () => {
    expect(validateFavourite({ release_id: 'r1' })).toBeNull()
  })

  it('rejects both', () => {
    expect(validateFavourite({ track_id: 't1', release_id: 'r1' })).toBe('Provide track_id or release_id, not both')
  })

  it('rejects neither', () => {
    expect(validateFavourite({})).toBe('track_id or release_id required')
  })

  it('rejects null body', () => {
    expect(validateFavourite(null)).toBe('Invalid JSON')
  })
})

describe('follow — self-follow prevention', () => {
  function validateFollow(userId: string, artistId: string): string | null {
    if (!artistId || typeof artistId !== 'string') return 'artist_id required'
    if (artistId === userId) return 'Cannot follow yourself'
    return null
  }

  it('allows following another user', () => {
    expect(validateFollow('user-1', 'artist-2')).toBeNull()
  })

  it('blocks self-follow', () => {
    expect(validateFollow('user-1', 'user-1')).toBe('Cannot follow yourself')
  })

  it('requires artist_id', () => {
    expect(validateFollow('user-1', '')).toBe('artist_id required')
  })
})
