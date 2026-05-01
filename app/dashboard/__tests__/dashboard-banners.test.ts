describe('Dashboard banner visibility', () => {
  type Release = { published: boolean }
  type Stats = {
    totalEarningsPence: number; totalSales: number
    totalPreviewPlays: number; totalFullPlays: number; uniqueFans: number
  }

  const zeroStats: Stats = {
    totalEarningsPence: 0, totalSales: 0,
    totalPreviewPlays: 0, totalFullPlays: 0, uniqueFans: 0,
  }

  function isAllZero(stats: Stats): boolean {
    return stats.totalEarningsPence === 0 && stats.totalSales === 0
      && stats.totalPreviewPlays === 0 && stats.totalFullPlays === 0
      && stats.uniqueFans === 0
  }

  function showWelcomeBanner(stats: Stats, stripeOnboarded: boolean, releases: Release[]): boolean {
    return isAllZero(stats) && stripeOnboarded && !releases.some(r => r.published)
  }

  function showStripeSetupBanner(stripeOnboarded: boolean): boolean {
    return !stripeOnboarded
  }

  // ── Welcome banner ──────────────────────────────────────

  it('shows welcome banner for new artist with no releases', () => {
    expect(showWelcomeBanner(zeroStats, true, [])).toBe(true)
  })

  it('hides welcome banner when artist has a published release (regression: YOUTH/Blue Lungs)', () => {
    expect(showWelcomeBanner(zeroStats, true, [{ published: true }])).toBe(false)
  })

  it('hides welcome banner when artist has sales even without releases', () => {
    expect(showWelcomeBanner({ ...zeroStats, totalSales: 1 }, true, [])).toBe(false)
  })

  it('hides welcome banner when stripe is not onboarded', () => {
    expect(showWelcomeBanner(zeroStats, false, [])).toBe(false)
  })

  it('hides welcome banner when artist has only draft releases', () => {
    expect(showWelcomeBanner(zeroStats, true, [{ published: false }])).toBe(true)
  })

  // ── Stripe setup banner ─────────────────────────────────

  it('shows stripe banner when not onboarded', () => {
    expect(showStripeSetupBanner(false)).toBe(true)
  })

  it('hides stripe banner when onboarded', () => {
    expect(showStripeSetupBanner(true)).toBe(false)
  })
})
