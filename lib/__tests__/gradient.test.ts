import { generateGradient, generateGradientDataUri } from '../gradient'

describe('generateGradient', () => {
  const artistId = 'artist-123'
  const releaseId = 'release-456'

  it('returns expected shape', () => {
    const result = generateGradient(artistId, releaseId)
    expect(result).toHaveProperty('colours')
    expect(result).toHaveProperty('angle')
    expect(result).toHaveProperty('css')
    expect(result).toHaveProperty('svg')
  })

  it('returns 2 or 3 colours', () => {
    const result = generateGradient(artistId, releaseId)
    expect(result.colours.length).toBeGreaterThanOrEqual(2)
    expect(result.colours.length).toBeLessThanOrEqual(3)
  })

  it('colours are valid hex strings', () => {
    const result = generateGradient(artistId, releaseId)
    for (const colour of result.colours) {
      expect(colour).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('angle is one of the 8 cardinal/diagonal angles', () => {
    const result = generateGradient(artistId, releaseId)
    const validAngles = [0, 45, 90, 135, 180, 225, 270, 315]
    expect(validAngles).toContain(result.angle)
  })

  it('CSS output contains linear-gradient', () => {
    const result = generateGradient(artistId, releaseId)
    expect(result.css).toContain('linear-gradient(')
    expect(result.css).toContain(`${result.angle}deg`)
  })

  it('SVG output is valid SVG markup', () => {
    const result = generateGradient(artistId, releaseId)
    expect(result.svg).toContain('<svg xmlns=')
    expect(result.svg).toContain('</svg>')
    expect(result.svg).toContain('<linearGradient')
    expect(result.svg).toContain('feTurbulence')
  })

  it('is deterministic — same input always produces same output', () => {
    const a = generateGradient(artistId, releaseId)
    const b = generateGradient(artistId, releaseId)
    expect(a).toEqual(b)
  })

  it('produces different gradients for different inputs', () => {
    const a = generateGradient('artist-A', 'release-1')
    const b = generateGradient('artist-B', 'release-2')
    expect(a.colours).not.toEqual(b.colours)
  })

  it('SVG size is 1200x1200', () => {
    const result = generateGradient(artistId, releaseId)
    expect(result.svg).toContain('width="1200"')
    expect(result.svg).toContain('height="1200"')
  })
})

describe('generateGradientDataUri', () => {
  it('returns a data: URI', () => {
    const uri = generateGradientDataUri('a', 'b')
    expect(uri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/)
  })

  it('URI is deterministic', () => {
    const a = generateGradientDataUri('a', 'b')
    const b = generateGradientDataUri('a', 'b')
    expect(a).toBe(b)
  })

  it('contains encoded SVG content', () => {
    const uri = generateGradientDataUri('a', 'b')
    const decoded = decodeURIComponent(uri.replace('data:image/svg+xml;charset=utf-8,', ''))
    expect(decoded).toContain('<svg')
  })
})
