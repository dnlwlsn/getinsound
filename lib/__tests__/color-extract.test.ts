import { hexToRgba } from '../color-extract'

describe('hexToRgba', () => {
  it('converts black with full opacity', () => {
    expect(hexToRgba('#000000', 1)).toBe('rgba(0,0,0,1)')
  })

  it('converts white with full opacity', () => {
    expect(hexToRgba('#ffffff', 1)).toBe('rgba(255,255,255,1)')
  })

  it('converts Insound orange with 0.5 alpha', () => {
    expect(hexToRgba('#F56D00', 0.5)).toBe('rgba(245,109,0,0.5)')
  })

  it('handles zero alpha', () => {
    expect(hexToRgba('#FF0000', 0)).toBe('rgba(255,0,0,0)')
  })

  it('converts mid-range colour', () => {
    expect(hexToRgba('#808080', 0.75)).toBe('rgba(128,128,128,0.75)')
  })

  it('handles primary red', () => {
    expect(hexToRgba('#FF0000', 1)).toBe('rgba(255,0,0,1)')
  })

  it('handles primary green', () => {
    expect(hexToRgba('#00FF00', 1)).toBe('rgba(0,255,0,1)')
  })

  it('handles primary blue', () => {
    expect(hexToRgba('#0000FF', 1)).toBe('rgba(0,0,255,1)')
  })
})
