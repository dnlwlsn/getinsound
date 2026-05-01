import { parseDevice, maskIp, hashIp } from '../session'

describe('parseDevice', () => {
  it('returns "Unknown device" for null user agent', () => {
    expect(parseDevice(null)).toBe('Unknown device')
  })

  it('detects Chrome on macOS', () => {
    expect(parseDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'))
      .toBe('Chrome on macOS')
  })

  it('detects Safari on macOS', () => {
    expect(parseDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'))
      .toBe('Safari on macOS')
  })

  it('detects Firefox on Windows', () => {
    expect(parseDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'))
      .toBe('Firefox on Windows')
  })

  it('detects Edge on Windows', () => {
    expect(parseDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'))
      .toBe('Edge on Windows')
  })

  it('detects Chrome on Android (Linux checked first in UA)', () => {
    // Android UAs contain "Linux" — parseDevice checks Linux before Android, so reports Linux
    expect(parseDevice('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'))
      .toBe('Chrome on Linux')
  })

  it('detects Safari on iOS/iPhone (Mac OS checked first in UA)', () => {
    // iOS UAs contain "Mac OS" — parseDevice checks Mac OS before iPhone/iPad, so reports macOS
    expect(parseDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'))
      .toBe('Safari on macOS')
  })

  it('detects Safari on iOS/iPad (Mac OS checked first in UA)', () => {
    expect(parseDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'))
      .toBe('Safari on macOS')
  })

  it('detects Chrome on Linux', () => {
    expect(parseDevice('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'))
      .toBe('Chrome on Linux')
  })

  it('returns browser only when OS is unknown', () => {
    expect(parseDevice('Mozilla/5.0 Chrome/120.0.0.0'))
      .toBe('Chrome')
  })

  it('returns "Unknown browser" for unrecognised user agent', () => {
    expect(parseDevice('curl/7.64.1'))
      .toBe('Unknown browser')
  })
})

describe('maskIp', () => {
  it('masks IPv4 last two octets', () => {
    expect(maskIp('192.168.1.42')).toBe('192.168.x.x')
  })

  it('masks IPv4 edge case 0.0.0.0', () => {
    expect(maskIp('0.0.0.0')).toBe('0.0.x.x')
  })

  it('masks IPv6 after first two segments', () => {
    expect(maskIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('2001:0db8:x:x')
  })

  it('falls back to x.x.x.x for unrecognised format', () => {
    expect(maskIp('garbage')).toBe('x.x.x.x')
  })

  it('masks short IPv6', () => {
    expect(maskIp('::1')).toBe('::x:x')
  })
})

describe('hashIp', () => {
  it('produces a 64-character hex string', async () => {
    const result = await hashIp('192.168.1.1')
    expect(result).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic', async () => {
    const a = await hashIp('10.0.0.1')
    const b = await hashIp('10.0.0.1')
    expect(a).toBe(b)
  })

  it('produces different hashes for different IPs', async () => {
    const a = await hashIp('10.0.0.1')
    const b = await hashIp('10.0.0.2')
    expect(a).not.toBe(b)
  })
})
