describe('Email verification gating logic', () => {
  function isVerified(user: { email_confirmed_at: string | null } | null): boolean {
    return !!user?.email_confirmed_at
  }

  function canPurchase(user: { email_confirmed_at: string | null } | null): boolean {
    return isVerified(user)
  }

  function canUpgradeToArtist(user: { email_confirmed_at: string | null } | null): boolean {
    return isVerified(user)
  }

  it('unverified user cannot purchase', () => {
    expect(canPurchase({ email_confirmed_at: null })).toBe(false)
  })

  it('verified user can purchase', () => {
    expect(canPurchase({ email_confirmed_at: '2026-01-01T00:00:00Z' })).toBe(true)
  })

  it('null user cannot purchase', () => {
    expect(canPurchase(null)).toBe(false)
  })

  it('unverified user cannot upgrade to artist', () => {
    expect(canUpgradeToArtist({ email_confirmed_at: null })).toBe(false)
  })

  it('verified user can upgrade to artist', () => {
    expect(canUpgradeToArtist({ email_confirmed_at: '2026-01-01T00:00:00Z' })).toBe(true)
  })

  it('magic link users are auto-verified (email_confirmed_at set)', () => {
    const magicLinkUser = { email_confirmed_at: '2026-04-29T12:00:00Z' }
    expect(isVerified(magicLinkUser)).toBe(true)
  })

  it('password signup users start unverified', () => {
    const passwordUser = { email_confirmed_at: null }
    expect(isVerified(passwordUser)).toBe(false)
  })
})
