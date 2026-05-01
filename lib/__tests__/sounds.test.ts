import { SOUNDS, SOUNDS_SET, MAX_RELEASE_TAGS, MAX_TAG_LENGTH } from '../sounds'

describe('SOUNDS', () => {
  it('has 16 genres', () => {
    expect(SOUNDS).toHaveLength(16)
  })

  it('includes key genres', () => {
    expect(SOUNDS).toContain('Indie')
    expect(SOUNDS).toContain('Electronic')
    expect(SOUNDS).toContain('Hip-Hop')
    expect(SOUNDS).toContain('Folk')
    expect(SOUNDS).toContain('Jazz')
    expect(SOUNDS).toContain('Experimental')
  })

  it('has no duplicates', () => {
    const unique = new Set(SOUNDS)
    expect(unique.size).toBe(SOUNDS.length)
  })

  it('all entries are non-empty strings', () => {
    for (const sound of SOUNDS) {
      expect(typeof sound).toBe('string')
      expect(sound.length).toBeGreaterThan(0)
    }
  })
})

describe('SOUNDS_SET', () => {
  it('matches SOUNDS array', () => {
    expect(SOUNDS_SET.size).toBe(SOUNDS.length)
    for (const sound of SOUNDS) {
      expect(SOUNDS_SET.has(sound)).toBe(true)
    }
  })

  it('rejects invalid genres', () => {
    expect(SOUNDS_SET.has('Dubstep')).toBe(false)
    expect(SOUNDS_SET.has('Pop')).toBe(false)
    expect(SOUNDS_SET.has('')).toBe(false)
  })
})

describe('constants', () => {
  it('MAX_RELEASE_TAGS is 3', () => {
    expect(MAX_RELEASE_TAGS).toBe(3)
  })

  it('MAX_TAG_LENGTH is 30', () => {
    expect(MAX_TAG_LENGTH).toBe(30)
  })
})
