import { referralShareUrl, twitterShareUrl, whatsappShareUrl, emailShareUrl } from '../referral'

describe('referralShareUrl', () => {
  it('generates correct base URL', () => {
    expect(referralShareUrl('ABC123')).toBe('https://getinsound.com?ref=ABC123')
  })
})

describe('twitterShareUrl', () => {
  it('generates twitter intent URL with encoded text', () => {
    const url = twitterShareUrl('ABC123')
    expect(url).toContain('https://twitter.com/intent/tweet?text=')
    expect(url).toContain(encodeURIComponent('https://getinsound.com?ref=ABC123'))
    expect(url).toContain(encodeURIComponent('@getinsound'))
  })
})

describe('whatsappShareUrl', () => {
  it('generates whatsapp URL with encoded text', () => {
    const url = whatsappShareUrl('ABC123')
    expect(url).toContain('https://wa.me/?text=')
    expect(url).toContain(encodeURIComponent('https://getinsound.com?ref=ABC123'))
  })
})

describe('emailShareUrl', () => {
  it('generates mailto URL with subject and body', () => {
    const url = emailShareUrl('ABC123')
    expect(url).toContain('mailto:?subject=')
    expect(url).toContain(encodeURIComponent('Join me on Insound'))
    expect(url).toContain(encodeURIComponent('https://getinsound.com?ref=ABC123'))
  })
})
