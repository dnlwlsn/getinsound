# Insound Audit Fixes — Comprehensive Instruction File

**Created:** 2026-04-29
**Purpose:** Execute all fixable audit findings from the deep product audit. Use this file to drive a fresh session.

---

## Important Corrections (Don't Re-Research These)

- **Social proof strip is NOT fake** — `app/page.tsx:68-111` queries real purchases/follows from last 24h via Supabase. The issue is only the empty fallback when no recent activity exists.
- **Stripe Connect EXISTS** — Dashboard has full onboarding popup, payout history, Express dashboard link. Founding artists get 7.5% fee.
- **Follow system EXISTS** — `FollowButton` component, `/api/follows`, follower counts on profiles, notifications.
- **Artist bio EXISTS on profiles** — `ArtistProfileClient.tsx` shows bio.
- **SEO is mostly done** — Sitemap at `/sitemap.ts`, JSON-LD for artists/fans, dynamic OG images.
- **Notifications system is comprehensive** — In-app real-time, push opt-in, preferences API.
- **Cookie consent already handled** — Middleware checks `insound_consent` cookie (lines 160-161).

---

## BATCH 1: Trust & Conversion (Quick Wins)

### 1.1 SocialProofStrip empty-state fallback
**File:** `app/components/ui/SocialProofStrip.tsx`
**Line:** 39 — `if (items.length === 0) return null`
**Fix:** Instead of returning null, show a static trust message:
```tsx
if (items.length === 0) {
  return (
    <section className="border-b border-zinc-900">
      <div className="max-w-7xl mx-auto px-5 md:px-10 py-4 flex items-center justify-center gap-3 min-h-[52px]">
        <p className="text-sm text-zinc-500">
          Independent music. Direct from artists. <span className="text-orange-500 font-bold">90% to creators.</span>
        </p>
      </div>
    </section>
  )
}
```

### 1.2 Homepage hero — rewrite for fans
**File:** `app/components/HomeClient.tsx`
**Lines:** 226-237 — The signed-out hero section
**Fix:** Rewrite to target fans, not artists:
```tsx
{!isLoggedIn && (
  <section className="border-b border-zinc-900 bg-zinc-950">
    <div className="max-w-7xl mx-auto px-5 md:px-10 py-8 md:py-12">
      <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight leading-tight">
        Discover music. <span className="text-orange-500">Support artists directly.</span>
      </h1>
      <p className="text-zinc-400 text-sm md:text-base mt-2 max-w-lg">
        Buy music directly from independent artists. No subscriptions, no algorithms — just great music you own forever. 90% goes straight to the artist.
      </p>
      <div className="flex items-center gap-3 mt-5">
        <Link href="/explore" className="bg-orange-600 text-black font-black text-sm px-5 py-2.5 rounded-xl hover:bg-orange-500 transition-colors">
          Browse Music
        </Link>
        <Link href="/for-fans" className="text-sm font-bold text-zinc-400 hover:text-white transition-colors">
          How it works →
        </Link>
      </div>
    </div>
  </section>
)}
```

### 1.3 Add /search to PUBLIC_ROUTES
**File:** `middleware.ts`
**Line:** 6
**Fix:** Add `'/search'` to the PUBLIC_ROUTES array:
```ts
const PUBLIC_ROUTES = ['/', '/auth', '/signup', '/explore', '/discover', '/release', '/search', '/why-us', '/for-artists', '/for-fans', '/for-press', '/privacy', '/terms', '/ai-policy']
```
Also add `'/faq'`, `'/redeem'`, and `'/download'` if they aren't already there — these should all be public.

### 1.4 Remove waitlist copy from why-us
**File:** `app/why-us/WhyUsClient.tsx`
**What to find:** Any "waitlist", "Register Interest", "Join the Waitlist" CTAs
**Fix:** Replace with direct signup/explore CTAs that match the for-artists page tone ("Start selling today" → Link to `/become-an-artist`, "Start discovering" → Link to `/explore`)

### 1.5 Link for-fans page in signed-out nav
**File:** `app/components/ui/AppNav.tsx`
**Context:** The signed-out nav (lines ~123-146) has no link to `/for-fans`
**Fix:** Add a "How It Works" or "For Fans" link in the signed-out nav pill bar, between the logo and the Sign In button.

### 1.6 Age gate — add context
**File:** `app/signup/SignupClient.tsx`
**Line:** ~213 — the "I confirm I am at least 18 years old" checkbox
**Fix:** Add a small helper text below: `<p className="text-[11px] text-zinc-600 mt-1">Required because we process payments through Stripe.</p>`

---

## BATCH 2: Mobile & UX

### 2.1 Add mobile search
**File:** `app/components/ui/AppNav.tsx`
**Problem:** Bottom nav has 4 tabs (Explore, For You, Collection, Profile) — no search. Signed-out nav has no search at all.
**Fix — signed-out:** Add a search icon/link to `/search` in the signed-out nav pill bar.
**Fix — signed-in mobile:** Either replace one bottom tab with Search, or add a search icon in the top mobile header bar. The simplest approach: add a search icon to the mobile top bar next to the basket icon (it may already exist — check `hidden md:block` on the SearchInput and change to always-visible, or add a search icon link for mobile).

### 2.2 Share buttons on release page
**File:** `app/release/ReleaseClient.tsx`
**Where:** After the buy/basket buttons section, or in the release details area
**Fix:** Add a share button group:
```tsx
<div className="flex items-center gap-2 mt-4">
  <button
    onClick={() => {
      const url = window.location.href
      if (navigator.share) {
        navigator.share({ title: `${release.title} by ${artist.name}`, url })
      } else {
        navigator.clipboard.writeText(url)
        // show "Copied!" toast
      }
    }}
    className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-white transition-colors"
  >
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
    </svg>
    Share
  </button>
</div>
```
Uses native Web Share API on mobile (which opens the OS share sheet), falls back to clipboard copy on desktop.

### 2.3 Sticky buy button on mobile
**File:** `app/release/ReleaseClient.tsx`
**Problem:** Buy CTA is inline, scrolls away on mobile
**Fix:** Add a sticky bottom bar on mobile that appears when the inline buy button scrolls out of view. Use an IntersectionObserver on the inline button to toggle visibility:
```tsx
// State
const [showStickyBuy, setShowStickyBuy] = useState(false)
const buyRef = useRef<HTMLDivElement>(null)

// Effect
useEffect(() => {
  if (!buyRef.current) return
  const obs = new IntersectionObserver(([e]) => setShowStickyBuy(!e.isIntersecting), { threshold: 0 })
  obs.observe(buyRef.current)
  return () => obs.disconnect()
}, [])

// Wrap inline buy button with ref
<div ref={buyRef}>{/* existing buy button */}</div>

// Sticky bar (render at bottom of component, before closing tags)
{showStickyBuy && (
  <div className="fixed bottom-[60px] left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 p-3 flex items-center justify-between gap-3 md:hidden">
    <div className="min-w-0">
      <p className="text-sm font-bold truncate">{release.title}</p>
      <p className="text-xs text-orange-500 font-bold">{price}</p>
    </div>
    {/* Same buy/basket button as inline */}
  </div>
)}
```
The `bottom-[60px]` accounts for the mobile bottom nav.

### 2.4 Player scrub target
**File:** `app/components/PlayerBar.tsx`
**Problem:** Progress bar is `h-1` (4px) — too thin for touch
**Fix:** Keep the visual bar at h-1 but wrap it in a larger invisible touch target:
```tsx
<div className="relative h-6 flex items-center cursor-pointer group" onClick={handleSeek}>
  <div className="absolute inset-x-0 h-1 bg-zinc-800 rounded-full top-1/2 -translate-y-1/2">
    <div className="h-full bg-orange-600 rounded-full" style={{ width: `${progress}%` }} />
  </div>
</div>
```
The outer div is 24px tall (easy to tap), the visual bar stays 4px. Apply this pattern to both the mini and expanded player progress bars.

### 2.5 Touch target fixes
**Files & fixes:**
- `app/components/ui/FavouriteButton.tsx` — Add `min-w-[44px] min-h-[44px]` or `p-3` padding to the button wrapper when used at small sizes
- `app/components/ui/BasketDrawer.tsx` — Remove button (lines ~319-327): increase from `p-1.5` to `p-2.5` and SVG from 14→16
- `app/components/ui/BasketDrawer.tsx` — PWYW +/- buttons: increase from `w-5 h-5` to `w-8 h-8`
- `app/explore/ExploreClient.tsx` — Play button circles: increase from `w-8 h-8` to `w-10 h-10`
- `app/components/ui/AppNav.tsx` — Hamburger button: add `min-w-[44px] min-h-[44px]` with centered icon

### 2.6 Minimum text size pass
**Find all `text-[8px]` across the codebase and bump to `text-[10px]`.**
These appear in:
- HomeClient (New badge)
- DiscoverClient (type badge, tags)
- ExploreClient (New badge)
- PlayerBar (repeat indicator)

`text-[9px]` is acceptable for the mobile nav labels and micro-labels (it's the established design token), but `text-[8px]` should not exist.

---

## BATCH 3: Auth & Checkout

### 3.1 Password as default auth (SKIP if Dan is removing magic link anyway)
**File:** `app/signup/SignupClient.tsx`
**Line:** ~19 — `authMethod` defaults to `'magic'`
**Fix:** Change default to `'password'`. Keep magic link as secondary option.
**Note:** Dan mentioned he might remove magic link entirely — check with him first.

### 3.2 Guest checkout improvement
**File:** `app/components/ui/BasketDrawer.tsx`
**Problem:** After guest purchase, user sees "Check your email" with no immediate download
**Fix:** After successful payment in the `wasGuest` flow, show immediate download links for digital items alongside the "check your email" message. The checkout session response should include the release IDs — use those to render download buttons directly. At minimum, change the copy to be more reassuring:
```
"Your music is ready! We've sent a receipt and sign-in link to your email. 
You can also download your tracks right now:"
```
Then show track download links using signed URLs from the checkout response.

### 3.3 Show minimum price in upload form
**File:** `app/discography/DiscographyClient.tsx`
**Where:** Near the price input in the new release form
**Fix:** Add helper text below the price input: `<p className="text-[10px] text-zinc-500 mt-1">Minimum £3.00</p>`
Also ensure the -/+ buttons don't go below 300 pence.

### 3.4 Post-purchase ZIP download
**File:** `app/release/ReleaseClient.tsx`
**Problem:** Post-purchase download stage shows per-track links only
**Fix:** Add a "Download All (ZIP)" button above the track list that uses the same `fflate` approach from `LibraryClient.tsx`. Import the ZIP logic as a shared utility.

---

## BATCH 4: Polish

### 4.1 Accessibility — focus-visible styles
**File:** `app/globals.css`
**Fix:** Add a global focus-visible style:
```css
:focus-visible {
  outline: 2px solid #ea580c;
  outline-offset: 2px;
}
```
This gives all focusable elements an orange focus ring matching the brand.

### 4.2 For-fans link in signed-out nav
Already covered in 1.5 above — ensure it happens.

### 4.3 Artist earnings preview in upload form
**File:** `app/discography/DiscographyClient.tsx`
**Where:** Below the price input
**Fix:** Show projected earnings:
```tsx
{price >= 300 && (
  <p className="text-[10px] text-zinc-500 mt-1">
    You'll receive ~{formatPrice((price * 0.9) / 100)} after fees
  </p>
)}
```
Use 90% as the default, or 92.5% if the artist has a founding badge (check if this info is available in the component).

---

## BATCH 5: Next-Session Features (Cannot Be Done in a Quick Fix)

### 5.1 Add tracks to existing releases
**Scope:** Medium — needs UI in EditReleaseModal to upload additional tracks, plus API/storage logic
**Files:** `app/discography/DiscographyClient.tsx` (EditReleaseModal section), possibly a new API route
**Approach:** The edit modal already handles title/description/genre changes. Add a track upload section that reuses the same upload logic from the create flow.

### 5.2 Multi-currency artist pricing
**Scope:** Large — requires Stripe Connect changes, currency field on artists table, checkout flow updates
**Approach:** Add a `currency` column to artists table. Let artists choose their currency during onboarding or in settings. Checkout uses the artist's currency for Stripe. Display prices convert to fan's currency for browsing but charge in artist's currency.

### 5.3 Sales page rebuild
**File:** `app/sales/SalesClient.tsx`
**Scope:** Medium — needs order-level data, date filtering, per-release breakdown
**Approach:** Query orders table with joins to releases/merch. Add date range filter (today/week/month/all). Show per-order rows with release name, amount, date, status. Add CSV export.

### 5.4 Merge wishlist & favourites
**Scope:** Small-medium — unify into one system or clearly differentiate in UI
**Approach:** Simplest: remove the separate wishlist and use favourites as the "saved" mechanism. The Library "Saved" tab shows favourited releases. Alternatively, rename favourites to "Liked" and wishlist to "Want" with clear UI differentiation.

### 5.5 Security settings page
**File:** `app/settings/security/SecuritySettingsClient.tsx`
**Scope:** Small — add password change form (if password auth exists), show active sessions
**Approach:** Use Supabase's `updateUser({ password })` for password changes. Session list from `supabase.auth.mfa.listFactors()` or session tracking table.

### 5.6 About/Founder page
**Scope:** Small — needs Dan's content
**Approach:** Create `app/about/page.tsx` with: Dan's photo, the Insound story, company details (from privacy policy: Insound Music Ltd, Companies House 17179694), social link (@getinsound on Instagram). Add to nav footer and PUBLIC_ROUTES.

### 5.7 Independent labels (future)
**Scope:** Large — new entity type, multi-artist management, revenue splitting
**Notes:** Dan mentioned wanting to discuss bringing on independent labels. This would need: a "label" account type, ability to manage multiple artists under one dashboard, configurable revenue splits (label → artist → platform), label profile pages, and possibly sub-accounts for individual artists within a label.

---

## Files Modified in Previous Session (Already in Working Tree)

The `next/image` migration is already done across 14 files. These changes are uncommitted:
- ExploreClient, LibraryClient, ReleaseClient, HomeClient, DiscoverClient
- ArtistProfileClient, DashboardClient, SearchClient, BasketDrawer
- QueuePanel, DiscographyClient, SearchInput, DownloadClient, MerchCard, MerchItemClient

Plus all changes from earlier audit fix batches (hardcoded hex values, error messages, route error boundaries, etc.)

---

## Execution Order for Next Session

1. Start with Batch 1 (trust/conversion) — highest user impact
2. Then Batch 2 (mobile/UX) — affects every mobile visitor
3. Then Batch 3 (auth/checkout) — affects conversion
4. Then Batch 4 (polish) — quick wins
5. Then build test and verify
6. Commit everything as one or two logical commits
