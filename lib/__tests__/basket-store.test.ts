import { useBasketStore, ReleaseBasketItem, MerchBasketItem, PriceChange } from '../stores/basket'

const makeRelease = (overrides: Partial<ReleaseBasketItem> = {}): ReleaseBasketItem => ({
  type: 'release',
  releaseId: 'rel-1',
  releaseTitle: 'Album',
  releaseSlug: 'album',
  coverUrl: null,
  artistId: 'art-1',
  artistName: 'Artist',
  artistSlug: 'artist',
  pricePence: 1000,
  currency: 'GBP',
  accentColour: null,
  ...overrides,
})

const makeMerch = (overrides: Partial<MerchBasketItem> = {}): MerchBasketItem => ({
  type: 'merch',
  merchId: 'merch-1',
  merchName: 'T-Shirt',
  variant: 'M',
  postagePence: 300,
  photoUrl: null,
  artistId: 'art-1',
  artistName: 'Artist',
  artistSlug: 'artist',
  pricePence: 2000,
  currency: 'GBP',
  accentColour: null,
  ...overrides,
})

beforeEach(() => {
  useBasketStore.getState().clear()
})

describe('basket store — add', () => {
  it('adds a release item', () => {
    useBasketStore.getState().add(makeRelease())
    expect(useBasketStore.getState().items).toHaveLength(1)
    expect(useBasketStore.getState().items[0].type).toBe('release')
  })

  it('adds a merch item', () => {
    useBasketStore.getState().add(makeMerch())
    expect(useBasketStore.getState().items).toHaveLength(1)
    expect(useBasketStore.getState().items[0].type).toBe('merch')
  })

  it('prevents duplicate releases', () => {
    useBasketStore.getState().add(makeRelease())
    useBasketStore.getState().add(makeRelease())
    expect(useBasketStore.getState().items).toHaveLength(1)
  })

  it('prevents duplicate merch (same id + variant)', () => {
    useBasketStore.getState().add(makeMerch())
    useBasketStore.getState().add(makeMerch())
    expect(useBasketStore.getState().items).toHaveLength(1)
  })

  it('allows merch with different variants', () => {
    useBasketStore.getState().add(makeMerch({ variant: 'S' }))
    useBasketStore.getState().add(makeMerch({ variant: 'L' }))
    expect(useBasketStore.getState().items).toHaveLength(2)
  })

  it('enforces MAX_ITEMS limit (20)', () => {
    for (let i = 0; i < 25; i++) {
      useBasketStore.getState().add(makeRelease({ releaseId: `rel-${i}` }))
    }
    expect(useBasketStore.getState().items).toHaveLength(20)
  })
})

describe('basket store — remove', () => {
  it('removes a release', () => {
    const item = makeRelease()
    useBasketStore.getState().add(item)
    useBasketStore.getState().remove(item)
    expect(useBasketStore.getState().items).toHaveLength(0)
  })

  it('removes correct merch variant', () => {
    const small = makeMerch({ variant: 'S' })
    const large = makeMerch({ variant: 'L' })
    useBasketStore.getState().add(small)
    useBasketStore.getState().add(large)
    useBasketStore.getState().remove(small)
    expect(useBasketStore.getState().items).toHaveLength(1)
    expect((useBasketStore.getState().items[0] as MerchBasketItem).variant).toBe('L')
  })

  it('does nothing when removing non-existent item', () => {
    useBasketStore.getState().add(makeRelease())
    useBasketStore.getState().remove(makeRelease({ releaseId: 'non-existent' }))
    expect(useBasketStore.getState().items).toHaveLength(1)
  })
})

describe('basket store — has', () => {
  it('returns true for items in basket', () => {
    const item = makeRelease()
    useBasketStore.getState().add(item)
    expect(useBasketStore.getState().has(item)).toBe(true)
  })

  it('returns false for items not in basket', () => {
    expect(useBasketStore.getState().has(makeRelease())).toBe(false)
  })
})

describe('basket store — addMany', () => {
  it('adds multiple items at once', () => {
    const items = [
      makeRelease({ releaseId: 'r1' }),
      makeRelease({ releaseId: 'r2' }),
    ]
    const count = useBasketStore.getState().addMany(items)
    expect(count).toBe(2)
    expect(useBasketStore.getState().items).toHaveLength(2)
  })

  it('skips already existing items', () => {
    useBasketStore.getState().add(makeRelease({ releaseId: 'r1' }))
    const count = useBasketStore.getState().addMany([
      makeRelease({ releaseId: 'r1' }),
      makeRelease({ releaseId: 'r2' }),
    ])
    expect(count).toBe(1)
    expect(useBasketStore.getState().items).toHaveLength(2)
  })

  it('respects MAX_ITEMS across addMany', () => {
    for (let i = 0; i < 19; i++) {
      useBasketStore.getState().add(makeRelease({ releaseId: `r${i}` }))
    }
    const count = useBasketStore.getState().addMany([
      makeRelease({ releaseId: 'rA' }),
      makeRelease({ releaseId: 'rB' }),
    ])
    expect(count).toBe(1)
    expect(useBasketStore.getState().items).toHaveLength(20)
  })
})

describe('basket store — updateCustomAmount', () => {
  it('updates PWYW custom amount', () => {
    useBasketStore.getState().add(makeRelease({ pwyw: true, customAmountPence: 1000 }))
    useBasketStore.getState().updateCustomAmount('rel-1', 1500)
    const item = useBasketStore.getState().items[0] as ReleaseBasketItem
    expect(item.customAmountPence).toBe(1500)
  })

  it('does not affect other items', () => {
    useBasketStore.getState().add(makeRelease({ releaseId: 'r1', customAmountPence: 1000 }))
    useBasketStore.getState().add(makeRelease({ releaseId: 'r2', customAmountPence: 2000 }))
    useBasketStore.getState().updateCustomAmount('r1', 1500)
    const r2 = useBasketStore.getState().items[1] as ReleaseBasketItem
    expect(r2.customAmountPence).toBe(2000)
  })
})

describe('basket store — totals', () => {
  it('calculates itemsTotal with custom amounts', () => {
    useBasketStore.getState().add(makeRelease({ pricePence: 1000, customAmountPence: 1500 }))
    useBasketStore.getState().add(makeMerch({ pricePence: 2000 }))
    expect(useBasketStore.getState().itemsTotal()).toBe(3500)
  })

  it('uses pricePence when no custom amount', () => {
    useBasketStore.getState().add(makeRelease({ pricePence: 1000 }))
    expect(useBasketStore.getState().itemsTotal()).toBe(1000)
  })

  it('calculates postageTotal from merch only', () => {
    useBasketStore.getState().add(makeRelease())
    useBasketStore.getState().add(makeMerch({ postagePence: 300 }))
    useBasketStore.getState().add(makeMerch({ merchId: 'merch-2', postagePence: 500 }))
    expect(useBasketStore.getState().postageTotal()).toBe(800)
  })

  it('total = itemsTotal + postageTotal', () => {
    useBasketStore.getState().add(makeRelease({ pricePence: 1000 }))
    useBasketStore.getState().add(makeMerch({ pricePence: 2000, postagePence: 300 }))
    expect(useBasketStore.getState().total()).toBe(3300)
  })

  it('empty basket has zero total', () => {
    expect(useBasketStore.getState().total()).toBe(0)
  })
})

describe('basket store — hasMerch', () => {
  it('returns false when empty', () => {
    expect(useBasketStore.getState().hasMerch()).toBe(false)
  })

  it('returns false with only releases', () => {
    useBasketStore.getState().add(makeRelease())
    expect(useBasketStore.getState().hasMerch()).toBe(false)
  })

  it('returns true with merch', () => {
    useBasketStore.getState().add(makeMerch())
    expect(useBasketStore.getState().hasMerch()).toBe(true)
  })
})

describe('basket store — applyPriceChanges', () => {
  it('updates release price', () => {
    const item = makeRelease({ pricePence: 1000 })
    useBasketStore.getState().add(item)
    useBasketStore.getState().applyPriceChanges([
      { item, oldPricePence: 1000, newPricePence: 1200 },
    ])
    expect((useBasketStore.getState().items[0] as ReleaseBasketItem).pricePence).toBe(1200)
  })

  it('updates custom amount when it matched old price', () => {
    const item = makeRelease({ pricePence: 1000, customAmountPence: 1000 })
    useBasketStore.getState().add(item)
    useBasketStore.getState().applyPriceChanges([
      { item, oldPricePence: 1000, newPricePence: 1200 },
    ])
    expect((useBasketStore.getState().items[0] as ReleaseBasketItem).customAmountPence).toBe(1200)
  })

  it('bumps PWYW custom amount to minimum when below new price', () => {
    // pwywMinimumPence is undefined so pricePence is used as minimum
    const item = makeRelease({ pricePence: 500, customAmountPence: 600, pwyw: true })
    useBasketStore.getState().add(item)
    useBasketStore.getState().applyPriceChanges([
      { item, oldPricePence: 500, newPricePence: 800 },
    ])
    const updated = useBasketStore.getState().items[0] as ReleaseBasketItem
    // customAmountPence 600 < new pricePence 800, so bumped to 800
    expect(updated.customAmountPence).toBe(800)
  })

  it('updates merch postage when provided', () => {
    const item = makeMerch({ pricePence: 2000, postagePence: 300 })
    useBasketStore.getState().add(item)
    useBasketStore.getState().applyPriceChanges([
      { item, oldPricePence: 2000, newPricePence: 2500, oldPostagePence: 300, newPostagePence: 400 },
    ])
    const updated = useBasketStore.getState().items[0] as MerchBasketItem
    expect(updated.pricePence).toBe(2500)
    expect(updated.postagePence).toBe(400)
  })
})

describe('basket store — clear', () => {
  it('removes all items', () => {
    useBasketStore.getState().add(makeRelease())
    useBasketStore.getState().add(makeMerch())
    useBasketStore.getState().clear()
    expect(useBasketStore.getState().items).toHaveLength(0)
  })
})
