# Merch in Basket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow fans to add merch items to the basket alongside music releases and check out in a single transaction, with per-item fee calculation (zero-fees for music only), per-item postage, and a transparent breakdown in the UI.

**Architecture:** The basket store gains a discriminated union type (`'release' | 'merch'`). The checkout edge function fetches from both `releases` and `merch` tables, builds mixed line items, conditionally adds shipping address collection, and calculates fees per-item. The webhook processes each item type through its existing handler logic. The drawer UI shows a transparent breakdown with separate P&P line.

**Tech Stack:** Next.js (App Router), Zustand, Stripe Checkout (embedded), Supabase Edge Functions (Deno), Supabase Postgres

**Spec:** `docs/superpowers/specs/2026-04-27-merch-in-basket-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/functions/_shared/constants.ts` | Modify | Add `SHIPPING_COUNTRIES` array |
| `lib/stores/basket.ts` | Modify | Discriminated union types, new dedupe/total logic |
| `app/components/ui/AddToBasketButton.tsx` | Modify | Support merch items alongside releases |
| `app/[slug]/merch/[merchId]/MerchItemClient.tsx` | Modify | Add "Add to basket" button |
| `app/components/ui/BasketDrawer.tsx` | Modify | Mixed item rendering, P&P breakdown, post-checkout split |
| `supabase/functions/checkout-basket-create/index.ts` | Modify | Accept merch items, fetch merch, build mixed line items, shipping, fees |
| `supabase/functions/checkout-merch-create/index.ts` | Modify | Import `SHIPPING_COUNTRIES` from shared |
| `supabase/functions/stripe-webhook/index.ts` | Modify | Handle merch items in basket flow |

---

### Task 1: Extract shipping countries to shared constants

**Files:**
- Modify: `supabase/functions/_shared/constants.ts`
- Modify: `supabase/functions/checkout-merch-create/index.ts:114-116`

- [ ] **Step 1: Add SHIPPING_COUNTRIES to shared constants**

In `supabase/functions/_shared/constants.ts`, add:

```ts
export const SHIPPING_COUNTRIES: string[] = [
  'GB', 'US', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE',
  'AT', 'IE', 'PT', 'FI', 'SE', 'DK', 'NO', 'JP',
];
```

- [ ] **Step 2: Update checkout-merch-create to use shared constant**

In `supabase/functions/checkout-merch-create/index.ts`, add to the import:

```ts
import { PLATFORM_FEE_BPS, SHIPPING_COUNTRIES } from '../_shared/constants.ts';
```

Replace the inline `allowed_countries` array:

```ts
      shipping_address_collection: {
        allowed_countries: SHIPPING_COUNTRIES as [string, ...string[]],
      },
```

The `as [string, ...string[]]` cast satisfies Stripe's type which requires a non-empty tuple.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/constants.ts supabase/functions/checkout-merch-create/index.ts
git commit -m "refactor: extract SHIPPING_COUNTRIES to shared constants"
```

---

### Task 2: Update basket store for merch support

**Files:**
- Modify: `lib/stores/basket.ts`

- [ ] **Step 1: Replace BasketItem with discriminated union**

Replace the entire contents of `lib/stores/basket.ts`:

```ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface BaseItem {
  artistId: string
  artistName: string
  artistSlug: string
  pricePence: number
  currency: string
  accentColour: string | null
}

export interface ReleaseBasketItem extends BaseItem {
  type: 'release'
  releaseId: string
  releaseTitle: string
  releaseSlug: string
  coverUrl: string | null
  customAmountPence?: number
}

export interface MerchBasketItem extends BaseItem {
  type: 'merch'
  merchId: string
  merchName: string
  variant: string | null
  postagePence: number
  photoUrl: string | null
}

export type BasketItem = ReleaseBasketItem | MerchBasketItem

function itemKey(item: BasketItem): string {
  if (item.type === 'merch') return `merch:${item.merchId}:${item.variant ?? ''}`
  return `release:${item.releaseId}`
}

interface BasketState {
  items: BasketItem[]
  add: (item: BasketItem) => void
  remove: (item: BasketItem) => void
  clear: () => void
  has: (item: BasketItem) => boolean
  itemsTotal: () => number
  postageTotal: () => number
  total: () => number
  hasMerch: () => boolean
}

const MAX_ITEMS = 20

export const useBasketStore = create<BasketState>()(
  persist(
    (set, get) => ({
      items: [],

      add: (item: BasketItem) => {
        const { items } = get()
        const key = itemKey(item)
        if (items.some(i => itemKey(i) === key)) return
        if (items.length >= MAX_ITEMS) return
        set({ items: [...items, item] })
      },

      remove: (item: BasketItem) => {
        const key = itemKey(item)
        set({ items: get().items.filter(i => itemKey(i) !== key) })
      },

      clear: () => set({ items: [] }),

      has: (item: BasketItem) => {
        const key = itemKey(item)
        return get().items.some(i => itemKey(i) === key)
      },

      itemsTotal: () => {
        return get().items.reduce((sum, i) => {
          if (i.type === 'release') return sum + (i.customAmountPence ?? i.pricePence)
          return sum + i.pricePence
        }, 0)
      },

      postageTotal: () => {
        return get().items.reduce((sum, i) => {
          if (i.type === 'merch') return sum + i.postagePence
          return sum
        }, 0)
      },

      total: () => {
        return get().itemsTotal() + get().postageTotal()
      },

      hasMerch: () => get().items.some(i => i.type === 'merch'),
    }),
    {
      name: 'insound-basket',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
```

- [ ] **Step 2: Commit**

```bash
git add lib/stores/basket.ts
git commit -m "feat: update basket store with merch support and discriminated union types"
```

---

### Task 3: Update AddToBasketButton for merch items

**Files:**
- Modify: `app/components/ui/AddToBasketButton.tsx`

The `AddToBasketButton` currently takes a `BasketItem` prop and uses `item.releaseId` for deduplication. Since `has()` and `add()` now accept the full `BasketItem` union, the component needs minimal changes — just update the type import and the `has`/`remove` calls.

- [ ] **Step 1: Update the component**

In `app/components/ui/AddToBasketButton.tsx`, the `has()` call on line 27 currently passes `item.releaseId`. Change it to pass the full item:

Replace:
```tsx
  const inBasket = has(item.releaseId)
```

With:
```tsx
  const inBasket = has(item)
```

The `has` function signature changed from `(releaseId: string)` to `(item: BasketItem)` in the store update.

- [ ] **Step 2: Verify no other direct releaseId references in the component**

The component's `handleClick` calls `add(item)` which already passes the full item — that's fine. The `aria-label` on line 84 uses a ternary with `inBasket` — that's fine too.

The component renders an `item.releaseId` as the `key` prop nowhere (it's used inline) — no changes needed there.

- [ ] **Step 3: Commit**

```bash
git add app/components/ui/AddToBasketButton.tsx
git commit -m "feat: update AddToBasketButton to use new BasketItem union type"
```

---

### Task 4: Rewrite BasketDrawer for mixed baskets

**Files:**
- Modify: `app/components/ui/BasketDrawer.tsx`

This is the full drawer rewrite with P&P breakdown, mixed item rendering, and split post-checkout stages.

- [ ] **Step 1: Update the item rendering in the review stage**

Replace the `artistItems.map` callback (lines 190-220) with a version that handles both item types using type narrowing:

In the `artistItems.map` callback, add a type narrowing check:

```tsx
{artistItems.map((item) => {
  const displayPrice = item.type === 'release'
    ? formatPrice(convertPrice((item.customAmountPence ?? item.pricePence) / 100, item.currency || 'GBP', currency))
    : formatPrice(convertPrice(item.pricePence / 100, item.currency || 'GBP', currency))
  const label = item.type === 'release' ? item.releaseTitle : item.merchName
  const imageUrl = item.type === 'release' ? item.coverUrl : item.photoUrl
  const linkHref = item.type === 'release'
    ? `/release?a=${item.artistSlug}&r=${item.releaseSlug}`
    : `/${item.artistSlug}/merch/${item.merchId}`
  const key = item.type === 'release' ? item.releaseId : `${item.merchId}-${item.variant ?? ''}`

  return (
    <div key={key} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-[#141414] transition-colors">
      <Link href={linkHref} className="w-10 h-10 rounded shrink-0 overflow-hidden bg-zinc-900">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-zinc-800" />
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={linkHref} className="font-semibold text-sm text-white truncate block hover:opacity-80 transition-opacity">
          {label}
        </Link>
        {item.type === 'merch' && item.variant && (
          <span className="text-[11px] text-zinc-500">{item.variant}</span>
        )}
        {item.type === 'merch' && item.postagePence > 0 && (
          <span className="text-[11px] text-zinc-600">
            + {formatPrice(convertPrice(item.postagePence / 100, item.currency || 'GBP', currency))} P&amp;P
          </span>
        )}
      </div>
      <span className="text-[13px] font-semibold text-orange-500 shrink-0">{displayPrice}</span>
      <button
        onClick={() => remove(item)}
        className="shrink-0 p-1.5 text-zinc-600 hover:text-red-400 transition-colors"
        aria-label={`Remove ${label}`}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
})}
```

- [ ] **Step 2: Update imports, types, and state**

Update the import:
```tsx
import { useBasketStore, type BasketItem } from '@/lib/stores/basket'
```

Add `'confirmed'` to the Stage type:
```tsx
type Stage = 'review' | 'checkout' | 'preparing' | 'consent' | 'download' | 'confirmed' | 'error'
```

Update store destructuring:
```tsx
const { items, remove, clear, total, itemsTotal, postageTotal, hasMerch } = useBasketStore()
```

Add state for tracking basket composition after existing state declarations:
```tsx
const [basketHadMerch, setBasketHadMerch] = useState(false)
const [basketHadReleases, setBasketHadReleases] = useState(false)
const [merchOrderNames, setMerchOrderNames] = useState<string[]>([])
```

- [ ] **Step 3: Update openCheckout to send typed items and track composition**

Replace the `openCheckout` callback:

```tsx
const openCheckout = useCallback(async () => {
  if (items.length === 0) return
  setStage('checkout')

  const hasReleases = items.some(i => i.type === 'release')
  const hasMerchItems = items.some(i => i.type === 'merch')
  setBasketHadReleases(hasReleases)
  setBasketHadMerch(hasMerchItems)
  setMerchOrderNames(
    items
      .filter((i): i is import('@/lib/stores/basket').MerchBasketItem => i.type === 'merch')
      .map(i => i.variant ? `${i.merchName} (${i.variant})` : i.merchName)
  )

  try {
    const stripe = (window as any).Stripe(STRIPE_PUBLISHABLE_KEY)
    const supabase = createClient()
    const refCookie = document.cookie.split('; ').find(c => c.startsWith('insound_ref='))
    const refCode = refCookie?.split('=')[1] || undefined

    const { data, error } = await supabase.functions.invoke('checkout-basket-create', {
      body: {
        items: items.map(i => {
          if (i.type === 'merch') {
            return { type: 'merch', merch_id: i.merchId, variant: i.variant ?? undefined }
          }
          return { type: 'release', release_id: i.releaseId, custom_amount: i.customAmountPence }
        }),
        fan_currency: currency,
        origin: window.location.origin,
        ref_code: refCode,
      },
    })
    if (error) throw error
    if (!data?.client_secret) throw new Error('No checkout session returned')

    sessionIdRef.current = data.session_id
    const embedded = await stripe.initEmbeddedCheckout({
      clientSecret: data.client_secret,
      onComplete: () => {
        setStage('preparing')
        if (hasReleases) {
          pollForDownloads(data.session_id)
        } else {
          clear()
          setStage('confirmed')
        }
      },
    })
    embeddedCheckoutRef.current = embedded

    requestAnimationFrame(() => {
      if (stripeMountRef.current) embedded.mount(stripeMountRef.current)
    })
  } catch (err: any) {
    setErrorTitle("Couldn't open checkout.")
    setErrorMsg(err.message || 'Please try again.')
    setStage('error')
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [items, currency])
```

- [ ] **Step 4: Update the review stage summary section**

Replace the total/checkout section (inside `stage === 'review'`, after the items map) with a breakdown:

```tsx
<div className="border-t border-zinc-800 pt-4 mt-4">
  <div className="space-y-2 mb-6">
    <div className="flex items-center justify-between">
      <span className="text-sm text-zinc-400">Subtotal</span>
      <span className="text-sm font-bold text-white">
        {formatPrice(convertPrice(itemsTotal() / 100, items[0]?.currency || 'GBP', currency))}
      </span>
    </div>
    {postageTotal() > 0 && (
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">P&amp;P</span>
        <span className="text-sm font-bold text-white">
          {formatPrice(convertPrice(postageTotal() / 100, items[0]?.currency || 'GBP', currency))}
        </span>
      </div>
    )}
    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
      <span className="text-sm font-bold text-zinc-400">Total</span>
      <span className="text-xl font-black text-orange-600">
        {formatPrice(convertPrice(total() / 100, items[0]?.currency || 'GBP', currency))}
      </span>
    </div>
  </div>
  {hasMerch() && (
    <p className="text-[10px] text-zinc-600 mb-3">
      Shipping address collected at checkout.
    </p>
  )}
  <button
    onClick={openCheckout}
    className="w-full bg-orange-600 hover:bg-orange-500 text-black font-black py-4 rounded-2xl text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
  >
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4-5M7 13l-2 6h12" />
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
    </svg>
    Checkout
  </button>
  <p className="text-center text-[10px] text-zinc-600 mt-3">
    {hasMerch() ? 'Instant download for music. Merch dispatched by the artist.' : 'Instant download after payment.'}
  </p>
</div>
```

- [ ] **Step 5: Replace the consent stage with mixed-basket version**

Replace the entire `{stage === 'consent' && (...)}` block:

```tsx
{stage === 'consent' && (
  <div className="p-6 md:p-8 mt-8">
    <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2">Payment received — thank you</p>
    <h2 className="text-2xl font-black mb-4 font-display">Your purchases</h2>

    {basketHadReleases && (
      <>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 mb-6">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={digitalConsent}
              onChange={e => setDigitalConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-700 bg-zinc-950 text-orange-600 focus:ring-orange-600 focus:ring-offset-0"
            />
            <span className="text-xs text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">
              I agree to immediate access to this digital content and acknowledge that I lose my 14-day cancellation right once the download starts.
            </span>
          </label>
        </div>
        <button
          onClick={async () => {
            if (!digitalConsent) return
            setConsentBusy(true)
            try {
              if (sessionIdRef.current) {
                const sb = createClient()
                await sb.functions.invoke('record-digital-consent', {
                  body: { session_id: sessionIdRef.current },
                })
              }
            } catch {}
            setConsentBusy(false)
            setStage('download')
          }}
          disabled={!digitalConsent || consentBusy}
          className="w-full bg-orange-600 hover:bg-orange-500 text-black font-black py-4 rounded-2xl text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
        >
          {consentBusy ? 'Processing...' : 'Access my downloads'}
        </button>
      </>
    )}

    {basketHadMerch && (
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Orders</p>
        {merchOrderNames.map((name, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500 shrink-0">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span className="text-sm text-white font-semibold">{name}</span>
          </div>
        ))}
        <p className="text-xs text-zinc-500 mt-3">You'll be notified when your order ships.</p>
      </div>
    )}

    {!basketHadReleases && basketHadMerch && (
      <button
        onClick={handleClose}
        className="w-full bg-orange-600 hover:bg-orange-500 text-black font-black py-4 rounded-2xl text-sm uppercase tracking-wider transition-colors mt-6"
      >
        Done
      </button>
    )}
  </div>
)}
```

- [ ] **Step 6: Update the download stage to include merch confirmation**

In the download stage, after the download tracks list and before the receipt line, add:

```tsx
{basketHadMerch && (
  <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 mb-4">
    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Orders</p>
    {merchOrderNames.map((name, i) => (
      <div key={i} className="flex items-center gap-3 py-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500 shrink-0">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <span className="text-sm text-white font-semibold">{name}</span>
      </div>
    ))}
    <p className="text-xs text-zinc-500 mt-3">You'll be notified when your order ships.</p>
  </div>
)}
```

- [ ] **Step 7: Add the confirmed stage (merch-only baskets)**

After the download stage block and before the error stage, add:

```tsx
{stage === 'confirmed' && (
  <div className="p-6 md:p-8 mt-8">
    <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2">Payment received — thank you</p>
    <h2 className="text-2xl font-black mb-6 font-display">Order confirmed</h2>
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 mb-6">
      {merchOrderNames.map((name, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500 shrink-0">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span className="text-sm text-white font-semibold">{name}</span>
        </div>
      ))}
      <p className="text-xs text-zinc-500 mt-3">You'll be notified when your order ships.</p>
    </div>
    <button onClick={handleClose} className="w-full bg-orange-600 hover:bg-orange-500 text-black font-black py-4 rounded-2xl text-sm uppercase tracking-wider transition-colors">
      Done
    </button>
    <p className="text-center text-[11px] text-zinc-600 font-medium mt-3">A receipt has been sent by Stripe.</p>
  </div>
)}
```

- [ ] **Step 8: Commit**

```bash
git add app/components/ui/BasketDrawer.tsx
git commit -m "feat: rewrite basket drawer for mixed release + merch baskets with P&P breakdown"
```

---

### Task 5: Add "Add to basket" button on merch detail page

**Files:**
- Modify: `app/[slug]/merch/[merchId]/MerchItemClient.tsx`

- [ ] **Step 1: Import basket store and AddToBasketButton**

At the top of `MerchItemClient.tsx`, add:

```ts
import { useBasketStore, type MerchBasketItem } from '@/lib/stores/basket'
```

- [ ] **Step 2: Add basket state and handler**

Inside the `MerchItemClient` component, after the existing state declarations (around line 50), add:

```tsx
const { add: addToBasket, has: inBasket } = useBasketStore()
const [addedToBasket, setAddedToBasket] = useState(false)

const merchBasketItem: MerchBasketItem | null = selectedVariant ? {
  type: 'merch',
  merchId: merch.id,
  merchName: merch.name,
  variant: selectedVariant === '__none__' ? null : selectedVariant,
  pricePence: merch.price,
  postagePence: merch.postage,
  currency: merch.currency || 'GBP',
  photoUrl: merch.photos[0] || null,
  artistId: artist.id,
  artistName: artist.name,
  artistSlug: artist.slug,
  accentColour: artist.accent_colour,
} : null

const isInBasket = merchBasketItem ? inBasket(merchBasketItem) : false

const handleAddToBasket = useCallback(() => {
  if (!merchBasketItem || isInBasket) return
  addToBasket(merchBasketItem)
  setAddedToBasket(true)
  setTimeout(() => setAddedToBasket(false), 2000)
}, [merchBasketItem, isInBasket, addToBasket])
```

- [ ] **Step 3: Add the "Add to basket" button alongside "Buy now"**

After the existing buy button (line 236), add the "Add to basket" button. Replace the single button with a button group:

Find the existing buy button block:
```tsx
            <button
              onClick={handleBuy}
              disabled={!canBuy || loading}
              className="w-full py-3.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: canBuy ? accent : undefined, color: canBuy ? '#000' : undefined }}
            >
              {loading ? 'Loading...' : soldOut ? 'Sold Out' : needsVariant && !selectedVariant ? 'Select a size' : `Buy — ${totalDisplay}`}
            </button>
```

Replace with:
```tsx
            <div className="flex gap-2">
              <button
                onClick={handleBuy}
                disabled={!canBuy || loading}
                className="flex-1 py-3.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: canBuy ? accent : undefined, color: canBuy ? '#000' : undefined }}
              >
                {loading ? 'Loading...' : soldOut ? 'Sold Out' : needsVariant && !selectedVariant ? 'Select a size' : `Buy — ${totalDisplay}`}
              </button>
              {!soldOut && (
                <button
                  onClick={handleAddToBasket}
                  disabled={!canBuy || isInBasket}
                  className="relative px-4 py-3.5 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label={isInBasket ? 'In basket' : 'Add to basket'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={isInBasket ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isInBasket ? 'text-orange-500' : ''}>
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
                  </svg>
                  {addedToBasket && (
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap bg-zinc-800 border border-zinc-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl z-50">
                      Added to basket
                    </span>
                  )}
                </button>
              )}
            </div>
```

- [ ] **Step 4: Commit**

```bash
git add app/[slug]/merch/[merchId]/MerchItemClient.tsx
git commit -m "feat: add 'Add to basket' button on merch detail page"
```

---

### Task 6: Update checkout-basket-create for mixed baskets

**Files:**
- Modify: `supabase/functions/checkout-basket-create/index.ts`

This is the largest change. The function needs to accept both release and merch items, fetch from both tables, build mixed Stripe line items, conditionally add shipping, and calculate fees per-item with zero-fees only for releases.

- [ ] **Step 1: Update the request item type and imports**

Replace the `BasketRequestItem` interface and add the import:

```ts
import { PLATFORM_FEE_BPS, SHIPPING_COUNTRIES } from '../_shared/constants.ts';

// ... existing stripe/supabase setup ...

type BasketRequestItem =
  | { type: 'release'; release_id: string; custom_amount?: number }
  | { type: 'merch'; merch_id: string; variant?: string }
```

- [ ] **Step 2: Rewrite the handler body**

Replace the entire `try` block inside `Deno.serve` with the new logic. Here is the complete new handler body:

```ts
  try {
    const body = await req.json().catch(() => ({}));
    const requestItems: BasketRequestItem[] = body.items;
    const origin: string = body.origin || 'https://getinsound.com';
    const fanCurrency: string | undefined = body.fan_currency;
    const refCode: string | undefined = body.ref_code;

    if (!requestItems || !Array.isArray(requestItems) || requestItems.length === 0) {
      return json({ error: 'items array required' }, 400);
    }
    if (requestItems.length > 20) {
      return json({ error: 'Maximum 20 items per basket' }, 400);
    }

    // Default untyped items to 'release' for backwards compat
    for (const item of requestItems) {
      if (!(item as any).type) (item as any).type = 'release';
    }

    const releaseItems = requestItems.filter((i): i is Extract<BasketRequestItem, { type: 'release' }> => i.type === 'release');
    const merchItems = requestItems.filter((i): i is Extract<BasketRequestItem, { type: 'merch' }> => i.type === 'merch');

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Fetch releases ──
    let releases: any[] = [];
    if (releaseItems.length > 0) {
      const releaseIds = releaseItems.map(i => i.release_id);
      const { data, error: relErr } = await admin
        .from('releases')
        .select(`
          id, slug, title, price_pence, currency, cover_url, published, artist_id,
          preorder_enabled, release_date, pwyw_enabled, pwyw_minimum_pence,
          artists!inner ( id, slug, name )
        `)
        .in('id', releaseIds)
        .eq('published', true);

      if (relErr) return json({ error: relErr.message }, 500);
      if (!data || data.length === 0) return json({ error: 'No valid releases found' }, 404);

      const staleIds = releaseIds.filter(id => !data.find((r: any) => r.id === id));
      if (staleIds.length > 0) {
        return json({ error: 'Some items are no longer available', stale_ids: staleIds }, 400);
      }
      releases = data;
    }

    // ── Fetch merch ──
    let merchData: any[] = [];
    if (merchItems.length > 0) {
      const merchIds = merchItems.map(i => i.merch_id);
      const { data, error: merchErr } = await admin
        .from('merch')
        .select(`
          id, name, price, currency, postage, stock, variants, is_active, photos,
          artist_id, artists!inner ( id, slug, name )
        `)
        .in('id', merchIds)
        .eq('is_active', true);

      if (merchErr) return json({ error: merchErr.message }, 500);
      if (!data || data.length === 0) return json({ error: 'No valid merch found' }, 404);

      const staleIds = merchIds.filter(id => !data.find((m: any) => m.id === id));
      if (staleIds.length > 0) {
        return json({ error: 'Some merch items are no longer available', stale_ids: staleIds }, 400);
      }

      // Validate stock and variants
      for (const reqItem of merchItems) {
        const m = data.find((d: any) => d.id === reqItem.merch_id)!;
        if (m.stock <= 0) return json({ error: `${m.name} is sold out` }, 400);
        if (reqItem.variant && m.variants) {
          const variants = m.variants as string[];
          if (!variants.includes(reqItem.variant)) {
            return json({ error: `Invalid variant for ${m.name}` }, 400);
          }
        }
      }
      merchData = data;
    }

    // ── Resolve Stripe accounts for all artists ──
    const allArtistIds = [
      ...new Set([
        ...releases.map((r: any) => r.artist_id),
        ...merchData.map((m: any) => m.artist_id),
      ]),
    ];

    const { data: accounts, error: accErr } = await admin
      .from('artist_accounts')
      .select('id, stripe_account_id, stripe_onboarded')
      .in('id', allArtistIds);

    if (accErr) return json({ error: accErr.message }, 500);

    const accountMap = new Map<string, string>();
    for (const acc of accounts || []) {
      if (!acc.stripe_onboarded || !acc.stripe_account_id) {
        const rel = releases.find((r: any) => r.artist_id === acc.id);
        const mer = merchData.find((m: any) => m.artist_id === acc.id);
        const artistObj = rel
          ? (Array.isArray(rel.artists) ? rel.artists[0] : rel.artists)
          : (mer ? (Array.isArray(mer.artists) ? mer.artists[0] : mer.artists) : null);
        return json({ error: `${artistObj?.name || 'An artist'} has not finished setting up payouts yet.` }, 400);
      }
      accountMap.set(acc.id, acc.stripe_account_id);
    }

    // ── Zero-fees check (releases only) ──
    const releaseArtistIds = [...new Set(releases.map((r: any) => r.artist_id))];
    const zeroFeesMap = new Map<string, boolean>();
    for (const artistId of releaseArtistIds) {
      const { data: zeroFees } = await admin
        .rpc('get_artist_zero_fees', { artist_id: artistId })
        .maybeSingle();

      let hasZeroFees = false;
      if (zeroFees?.zero_fees) {
        const start = zeroFees.fees_start;
        if (!start || (Date.now() - new Date(start).getTime()) < 365 * 24 * 60 * 60 * 1000) {
          hasZeroFees = true;
        }
      }
      zeroFeesMap.set(artistId, hasZeroFees);
    }

    // ── Build line items ──
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    const basketItems: any[] = [];
    let totalApplicationFee = 0;

    // Release line items
    for (const reqItem of releaseItems) {
      const release = releases.find((r: any) => r.id === reqItem.release_id)!;
      const artist = Array.isArray(release.artists) ? release.artists[0] : release.artists;
      const stripeAccountId = accountMap.get(release.artist_id)!;

      let unitAmount = release.price_pence;
      if (release.pwyw_enabled && reqItem.custom_amount != null) {
        const minimum = release.pwyw_minimum_pence ?? release.price_pence;
        if (reqItem.custom_amount >= minimum && reqItem.custom_amount >= release.price_pence) {
          unitAmount = reqItem.custom_amount;
        }
      }
      if (!unitAmount || unitAmount < 200) {
        return json({ error: `Invalid price for ${release.title}` }, 400);
      }

      let itemFee = Math.round((unitAmount * PLATFORM_FEE_BPS) / 10000);
      if (zeroFeesMap.get(release.artist_id)) {
        itemFee = 0;
      }
      totalApplicationFee += itemFee;

      lineItems.push({
        quantity: 1,
        price_data: {
          currency: (fanCurrency || release.currency || 'GBP').toLowerCase(),
          unit_amount: unitAmount,
          product_data: {
            name: release.title,
            description: `by ${artist.name}`,
            images: release.cover_url ? [release.cover_url] : undefined,
            metadata: {
              release_id: release.id,
              artist_id: artist.id,
            },
          },
        },
      });

      basketItems.push({
        type: 'release',
        release_id: release.id,
        artist_id: release.artist_id,
        amount_pence: unitAmount,
        stripe_account_id: stripeAccountId,
      });
    }

    // Merch line items
    for (const reqItem of merchItems) {
      const merch = merchData.find((m: any) => m.id === reqItem.merch_id)!;
      const artist = Array.isArray(merch.artists) ? merch.artists[0] : merch.artists;
      const stripeAccountId = accountMap.get(merch.artist_id)!;

      const itemFee = Math.round((merch.price * PLATFORM_FEE_BPS) / 10000);
      totalApplicationFee += itemFee;

      const photos = (merch.photos as string[]) || [];
      const variant = reqItem.variant || null;
      const itemName = variant ? `${merch.name} (${variant})` : merch.name;

      lineItems.push({
        quantity: 1,
        price_data: {
          currency: (fanCurrency || merch.currency || 'GBP').toLowerCase(),
          unit_amount: merch.price,
          product_data: {
            name: itemName,
            description: `by ${artist.name}`,
            images: photos.length > 0 ? [photos[0]] : undefined,
          },
        },
      });

      if (merch.postage > 0) {
        lineItems.push({
          quantity: 1,
          price_data: {
            currency: (fanCurrency || merch.currency || 'GBP').toLowerCase(),
            unit_amount: merch.postage,
            product_data: {
              name: `Postage — ${itemName}`,
            },
          },
        });
      }

      basketItems.push({
        type: 'merch',
        merch_id: merch.id,
        artist_id: merch.artist_id,
        amount_pence: merch.price,
        postage_pence: merch.postage,
        variant,
        stripe_account_id: stripeAccountId,
      });
    }

    // ── Store basket session ──
    const { data: basketRow, error: basketErr } = await admin
      .from('basket_sessions')
      .insert({
        items: basketItems,
        fan_currency: fanCurrency || 'GBP',
        ref_code: refCode || null,
      })
      .select('id')
      .single();

    if (basketErr) return json({ error: 'Failed to create basket session' }, 500);

    // ── Create Stripe session ──
    const hasMerch = merchItems.length > 0;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      ui_mode: 'embedded',
      redirect_on_completion: 'never',
      line_items: lineItems,
      payment_intent_data: {
        application_fee_amount: totalApplicationFee,
        metadata: {
          type: 'basket',
          basket_session_id: basketRow.id,
        },
      },
      metadata: {
        type: 'basket',
        basket_session_id: basketRow.id,
        fan_currency: fanCurrency || 'GBP',
      },
    };

    if (hasMerch) {
      sessionParams.shipping_address_collection = {
        allowed_countries: SHIPPING_COUNTRIES as [string, ...string[]],
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return json({
      client_secret: session.client_secret,
      session_id: session.id,
      has_merch: hasMerch,
      has_releases: releaseItems.length > 0,
    });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message || 'Internal error' }, 500);
  }
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/checkout-basket-create/index.ts
git commit -m "feat: checkout-basket-create handles mixed release + merch baskets"
```

---

### Task 7: Update stripe webhook for merch items in basket flow

**Files:**
- Modify: `supabase/functions/stripe-webhook/index.ts`

The basket handler (starting at line 261) currently processes all items as releases. It needs to branch on `item.type`.

- [ ] **Step 1: Update the basket item type**

In the basket handler section (around line 287), update the `basketItems` type:

```ts
type BasketItemData =
  | { type: 'release'; release_id: string; artist_id: string; amount_pence: number; stripe_account_id: string }
  | { type: 'merch'; merch_id: string; artist_id: string; amount_pence: number; postage_pence: number; variant: string | null; stripe_account_id: string };

const basketItems = basketSession.items as BasketItemData[];
```

Items without a `type` field are treated as `'release'` for backwards compat:
```ts
for (const item of basketItems) {
  if (!(item as any).type) (item as any).type = 'release';
}
```

- [ ] **Step 2: Update the transfer amount calculation and per-item loop**

The existing loop (line 348 onward) needs to branch on item type. Replace the loop body with type-aware processing.

For release items — keep existing logic (purchase insert, download grant, artist notification, zero-fees start).

For merch items — port from the standalone merch handler:

Inside the `for` loop, after computing `itemStripeFee`:

```ts
for (let idx = 0; idx < basketItems.length; idx++) {
  const item = basketItems[idx];
  const itemAmount = item.type === 'merch' ? item.amount_pence + item.postage_pence : item.amount_pence;
  const itemFraction = totalAmount > 0 ? itemAmount / totalAmount : 1 / basketItems.length;
  const itemStripeFee = idx === basketItems.length - 1
    ? stripeFeePence - basketItems.slice(0, -1).reduce((s, _, j) => {
        const jAmt = basketItems[j].type === 'merch'
          ? basketItems[j].amount_pence + (basketItems[j] as any).postage_pence
          : basketItems[j].amount_pence;
        return s + Math.round(stripeFeePence * (jAmt / totalAmount));
      }, 0)
    : Math.round(stripeFeePence * itemFraction);

  if (item.type === 'release') {
    // ── Existing release processing (unchanged) ──
    const platformPence = Math.round(item.amount_pence * 0.1);
    const artistPence = item.amount_pence - platformPence;

    const { data: release } = await admin
      .from('releases')
      .select('title, preorder_enabled, release_date, artists!inner(name)')
      .eq('id', item.release_id)
      .single();

    const releaseTitle = release?.title ?? 'Unknown';
    purchasedTitles.push(releaseTitle);
    const isPreOrder = release?.preorder_enabled && release?.release_date && new Date(release.release_date) > new Date();

    const { data: purchase, error: purchaseErr } = await admin
      .from('purchases')
      .insert({
        release_id: item.release_id,
        artist_id: item.artist_id,
        buyer_email: buyerEmail,
        buyer_user_id: userId,
        amount_pence: item.amount_pence,
        artist_pence: artistPence,
        platform_pence: platformPence,
        stripe_fee_pence: itemStripeFee,
        stripe_pi_id: piId ?? null,
        stripe_checkout_id: session.id,
        status: 'paid',
        paid_at: new Date().toISOString(),
        pre_order: !!isPreOrder,
        release_date: isPreOrder ? release!.release_date : null,
      })
      .select('id')
      .single();

    if (purchaseErr) {
      if (purchaseErr.code === '23505') continue;
      await logWebhookError(admin, event.type, event.id, `Basket purchase insert failed: ${purchaseErr.message}`, { item });
      continue;
    }

    if (chargeId && artistPence > 0) {
      try {
        await stripe.transfers.create({
          amount: artistPence,
          currency: (basketSession.fan_currency || 'GBP').toLowerCase(),
          destination: item.stripe_account_id,
          source_transaction: chargeId,
          transfer_group: transferGroup,
          metadata: { release_id: item.release_id, basket_session_id: basketSessionId },
        });
      } catch (e) {
        console.error(`Transfer failed for ${item.release_id}:`, (e as Error).message);
        await logWebhookError(admin, event.type, event.id, `Transfer failed: ${(e as Error).message}`, { item });
      }
    }

    if (!isPreOrder && purchase) {
      const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
      const expiresAt = new Date(Date.now() + GRANT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
      await admin.from('download_grants').insert({
        purchase_id: purchase.id, token, expires_at: expiresAt, max_uses: GRANT_MAX_USES,
      });
    }

    const saleLabel = `£${(item.amount_pence / 100).toFixed(2)}`;
    await admin.from('notifications').insert({
      user_id: item.artist_id,
      type: isPreOrder ? 'preorder' : 'sale',
      title: isPreOrder ? `New pre-order: ${releaseTitle}` : `New sale: ${releaseTitle}`,
      body: `${buyerEmail} purchased for ${saleLabel}`,
      link: '/dashboard',
    });

    try {
      await admin.rpc('set_zero_fees_start', { artist_id: item.artist_id });
    } catch (e) {
      console.error('Zero-fees start failed:', (e as Error).message);
    }

  } else if (item.type === 'merch') {
    // ── Merch processing (ported from standalone merch handler) ──
    const platformPence = Math.round(item.amount_pence * 0.1);
    const artistPence = item.amount_pence + item.postage_pence - platformPence;

    const { data: merchItem } = await admin
      .from('merch')
      .select('name, price, postage, currency')
      .eq('id', item.merch_id)
      .single();

    const itemName = item.variant ? `${merchItem?.name ?? 'Item'} (${item.variant})` : (merchItem?.name ?? 'Item');
    purchasedTitles.push(itemName);

    // Extract shipping address from Stripe session
    const shippingDetails = session.shipping_details ?? session.customer_details;
    const shippingAddress = shippingDetails?.address
      ? {
          name: shippingDetails.name || '',
          line1: shippingDetails.address.line1 || '',
          line2: shippingDetails.address.line2 || '',
          city: shippingDetails.address.city || '',
          postcode: shippingDetails.address.postal_code || '',
          country: shippingDetails.address.country || '',
        }
      : {};

    // Atomic stock decrement
    const { data: updated, error: stockErr } = await admin.rpc('decrement_merch_stock', {
      merch_id: item.merch_id,
    });

    if (stockErr || updated === false) {
      // Stock was 0 — can't fulfill. Log but don't refund entire basket.
      // Notify fan that this specific item couldn't be fulfilled.
      if (userId) {
        await admin.from('notifications').insert({
          user_id: userId,
          type: 'merch_order',
          title: `${itemName} is sold out`,
          body: 'This item from your basket could not be fulfilled. Contact us for a partial refund.',
          link: '/library',
        });
      }
      await logWebhookError(admin, event.type, event.id, `Merch sold out during basket checkout`, { merch_id: item.merch_id });
      continue;
    }

    // Insert order
    const { error: orderErr } = await admin
      .from('orders')
      .insert({
        fan_id: userId,
        artist_id: item.artist_id,
        merch_id: item.merch_id,
        variant_selected: item.variant,
        amount_paid: item.amount_pence + item.postage_pence,
        amount_paid_currency: merchItem?.currency || 'GBP',
        artist_received: artistPence,
        artist_received_currency: merchItem?.currency || 'GBP',
        platform_pence: platformPence,
        stripe_fee_pence: itemStripeFee,
        postage_paid: item.postage_pence,
        shipping_address: shippingAddress,
        status: 'pending',
        stripe_payment_intent_id: piId ?? null,
        stripe_checkout_id: session.id,
      });

    if (orderErr) {
      if (orderErr.code === '23505') continue;
      await logWebhookError(admin, event.type, event.id, `Basket merch order insert failed: ${orderErr.message}`, { item });
      continue;
    }

    // Transfer to artist (item + postage - platform fee)
    if (chargeId && artistPence > 0) {
      try {
        await stripe.transfers.create({
          amount: artistPence,
          currency: (basketSession.fan_currency || 'GBP').toLowerCase(),
          destination: item.stripe_account_id,
          source_transaction: chargeId,
          transfer_group: transferGroup,
          metadata: { merch_id: item.merch_id, basket_session_id: basketSessionId },
        });
      } catch (e) {
        console.error(`Transfer failed for merch ${item.merch_id}:`, (e as Error).message);
        await logWebhookError(admin, event.type, event.id, `Merch transfer failed: ${(e as Error).message}`, { item });
      }
    }

    // Notify artist
    if (await shouldNotifyInApp(admin, item.artist_id, 'merch_order')) {
      await admin.from('notifications').insert({
        user_id: item.artist_id,
        type: 'merch_order',
        title: `New merch order: ${itemName}`,
        body: `${buyerEmail} ordered${item.variant ? ` (${item.variant})` : ''}.`,
        link: '/dashboard',
      });
    }

    if (await shouldNotifyEmail(admin, item.artist_id, 'merch_order')) {
      const { data: artistRow } = await admin
        .from('artists')
        .select('email, name')
        .eq('id', item.artist_id)
        .single();
      if (artistRow?.email) {
        await sendEmail(
          artistRow.email,
          `New merch order: ${itemName}`,
          buildMerchOrderArtistEmail(itemName, buyerEmail, item.variant ? ` (${escapeHtml(item.variant)})` : ''),
        );
      }
    }

    // Notify fan
    if (userId && await shouldNotifyInApp(admin, userId, 'merch_order')) {
      await admin.from('notifications').insert({
        user_id: userId,
        type: 'merch_order',
        title: `Order confirmed: ${itemName}`,
        body: "You'll be notified when it ships.",
        link: '/library',
      });
    }
  }
}
```

Note: the `totalAmount` calculation (line 343 in the original) needs to include merch postage:

```ts
const totalAmount = basketItems.reduce((s, i) => {
  if (i.type === 'merch') return s + i.amount_pence + i.postage_pence;
  return s + i.amount_pence;
}, 0);
```

- [ ] **Step 3: Update the basket receipt email**

The `buildBasketReceiptEmail` function already takes `titles: string[]`. Since we're pushing merch item names into `purchasedTitles` alongside release titles, the receipt will list both. No change needed to the email function itself.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "feat: webhook handles merch items in basket checkout flow"
```

---

### Task 8: Update client-side callers for new basket API

**Files:**
- Modify: `app/[slug]/ArtistProfileClient.tsx` (if AddToBasketButton is used for releases here)

- [ ] **Step 1: Check and update any AddToBasketButton usage for releases**

The `AddToBasketButton` in `ArtistProfileClient.tsx` constructs a `BasketItem` to pass to the component. Since `BasketItem` is now a union, the item needs a `type: 'release'` field.

Find where `AddToBasketButton` is used and ensure the item passed includes `type: 'release'`. Search for where the `BasketItem` is constructed in the artist profile:

```bash
grep -n "AddToBasketButton\|BasketItem\|addToBasket\|add(" app/[slug]/ArtistProfileClient.tsx
```

Update the item construction to include `type: 'release'`.

- [ ] **Step 2: Check ReleaseClient.tsx**

```bash
grep -n "AddToBasketButton\|BasketItem\|addToBasket\|useBasketStore" app/release/ReleaseClient.tsx
```

If `ReleaseClient.tsx` constructs basket items, add `type: 'release'` there too.

- [ ] **Step 3: Commit**

```bash
git add app/[slug]/ArtistProfileClient.tsx app/release/ReleaseClient.tsx
git commit -m "feat: update release basket item construction with type discriminator"
```

---

### Task 9: End-to-end smoke test

No files to modify — this is manual verification.

- [ ] **Step 1: Start the dev server and test music-only basket**

Add 2 releases to basket, verify drawer shows correct items and total, proceed to checkout. Confirm post-checkout shows consent → downloads.

- [ ] **Step 2: Test merch-only basket**

Go to a merch detail page, select variant, click "Add to basket". Verify:
- Item appears in basket drawer with variant label
- P&P line shows in summary
- Checkout collects shipping address
- Post-checkout shows order confirmation (no consent/download)

- [ ] **Step 3: Test mixed basket**

Add a release AND a merch item. Verify:
- Both appear in drawer grouped by artist
- Summary shows Subtotal + P&P + Total
- "Shipping address collected at checkout" note appears
- Post-checkout shows consent/downloads for music AND order confirmation for merch

- [ ] **Step 4: Test edge cases**

- Add same merch item with different variants (both should appear)
- Add same merch item with same variant (should be deduplicated)
- Remove merch item from basket
- Empty basket state still works
- Merch "Buy now" button still works independently (standalone checkout)
