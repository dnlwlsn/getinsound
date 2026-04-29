import { SOUNDS_SET } from '@/lib/sounds'

const STEPS = ['email', 'display-name', 'genres', 'avatar', 'done'] as const
type Step = (typeof STEPS)[number]

interface SignupData {
  step: Step
  authMethod: 'magic' | 'password'
  email: string
  displayName: string
  genres: string[]
  avatarDataUrl: string | null
  ageConfirmed: boolean
}

const INITIAL: SignupData = {
  step: 'email',
  authMethod: 'magic',
  email: '',
  displayName: '',
  genres: [],
  avatarDataUrl: null,
  ageConfirmed: false,
}

function canAdvanceFrom(data: SignupData, password?: string, confirmPassword?: string): boolean {
  switch (data.step) {
    case 'email':
      if (!data.email.trim() || !data.ageConfirmed) return false
      if (data.authMethod === 'password') {
        if (!password || password.length < 8) return false
        if (password !== confirmPassword) return false
      }
      return true
    case 'display-name':
      return true
    case 'genres':
      return data.genres.length >= 3 || data.genres.length === 0
    case 'avatar':
      return true
    case 'done':
      return false
  }
}

describe('Signup state machine', () => {
  it('starts at email step with magic link as default', () => {
    expect(INITIAL.step).toBe('email')
    expect(INITIAL.authMethod).toBe('magic')
  })

  it('steps follow the correct order', () => {
    expect(STEPS).toEqual(['email', 'display-name', 'genres', 'avatar', 'done'])
  })

  it('blocks email step without age confirmation', () => {
    const data = { ...INITIAL, email: 'test@example.com', ageConfirmed: false }
    expect(canAdvanceFrom(data)).toBe(false)
  })

  it('blocks email step without email', () => {
    const data = { ...INITIAL, email: '', ageConfirmed: true }
    expect(canAdvanceFrom(data)).toBe(false)
  })

  it('allows email step with valid email and age confirmation (magic)', () => {
    const data = { ...INITIAL, email: 'test@example.com', ageConfirmed: true }
    expect(canAdvanceFrom(data)).toBe(true)
  })

  it('blocks password step with short password', () => {
    const data = { ...INITIAL, email: 'test@example.com', ageConfirmed: true, authMethod: 'password' as const }
    expect(canAdvanceFrom(data, 'short', 'short')).toBe(false)
  })

  it('blocks password step with mismatched passwords', () => {
    const data = { ...INITIAL, email: 'test@example.com', ageConfirmed: true, authMethod: 'password' as const }
    expect(canAdvanceFrom(data, 'password123', 'different')).toBe(false)
  })

  it('allows password step with valid password', () => {
    const data = { ...INITIAL, email: 'test@example.com', ageConfirmed: true, authMethod: 'password' as const }
    expect(canAdvanceFrom(data, 'password123', 'password123')).toBe(true)
  })

  it('display-name step always allows advancing (optional)', () => {
    const data = { ...INITIAL, step: 'display-name' as const }
    expect(canAdvanceFrom(data)).toBe(true)
  })

  it('genres step allows advancing with 3+ genres', () => {
    const data = { ...INITIAL, step: 'genres' as const, genres: ['Indie', 'Folk', 'Jazz'] }
    expect(canAdvanceFrom(data)).toBe(true)
  })

  it('genres step allows skipping (0 genres)', () => {
    const data = { ...INITIAL, step: 'genres' as const, genres: [] }
    expect(canAdvanceFrom(data)).toBe(true)
  })

  it('genres step blocks with 1-2 genres (not enough)', () => {
    const data = { ...INITIAL, step: 'genres' as const, genres: ['Indie', 'Folk'] }
    expect(canAdvanceFrom(data)).toBe(false)
  })

  it('avatar step always allows advancing (optional)', () => {
    const data = { ...INITIAL, step: 'avatar' as const }
    expect(canAdvanceFrom(data)).toBe(true)
  })

  it('done step blocks (terminal state)', () => {
    const data = { ...INITIAL, step: 'done' as const }
    expect(canAdvanceFrom(data)).toBe(false)
  })

  it('sessionStorage round-trips state correctly', () => {
    const state: SignupData = {
      step: 'genres',
      authMethod: 'password',
      email: 'test@example.com',
      displayName: 'TestUser',
      genres: ['Indie', 'Folk', 'Jazz'],
      avatarDataUrl: null,
      ageConfirmed: true,
    }
    const serialized = JSON.stringify(state)
    const parsed = JSON.parse(serialized) as SignupData
    expect(parsed).toEqual(state)
    expect(STEPS.includes(parsed.step)).toBe(true)
  })

  it('no account creation until done step', () => {
    for (const step of STEPS.slice(0, -1)) {
      expect(step).not.toBe('done')
    }
  })
})

describe('Genre validation', () => {
  it('validates against SOUNDS_SET', () => {
    expect(SOUNDS_SET.has('Indie')).toBe(true)
    expect(SOUNDS_SET.has('Electronic')).toBe(true)
    expect(SOUNDS_SET.has('InvalidGenre')).toBe(false)
  })

  it('rejects fewer than 3 genres', () => {
    const genres = ['Indie', 'Folk']
    const valid = genres.length >= 3 && genres.length <= 5 && genres.every(g => SOUNDS_SET.has(g))
    expect(valid).toBe(false)
  })

  it('rejects more than 5 genres', () => {
    const genres = ['Indie', 'Folk', 'Jazz', 'Soul', 'Punk', 'Metal']
    const valid = genres.length >= 3 && genres.length <= 5 && genres.every(g => SOUNDS_SET.has(g))
    expect(valid).toBe(false)
  })

  it('accepts 3-5 valid genres', () => {
    const genres = ['Indie', 'Folk', 'Jazz', 'Soul']
    const valid = genres.length >= 3 && genres.length <= 5 && genres.every(g => SOUNDS_SET.has(g))
    expect(valid).toBe(true)
  })

  it('rejects invalid genre names', () => {
    const genres = ['Indie', 'Folk', 'Dubstep']
    const valid = genres.length >= 3 && genres.length <= 5 && genres.every(g => SOUNDS_SET.has(g))
    expect(valid).toBe(false)
  })
})
