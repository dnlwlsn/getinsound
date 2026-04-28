# Phase 01 — Profiles, Releases & Player UI Review

**Audited:** 2026-04-28
**Baseline:** Abstract 6-pillar standards (no UI-SPEC exists)
**Screenshots:** Not captured (Playwright browsers not installed)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Strong contextual copy throughout; minor generic error messages |
| 2. Visuals | 4/4 | Excellent hierarchy, polished interactions, proper focal points |
| 3. Color | 3/4 | Good accent system via `resolveAccent()`; many hardcoded hex values bypass Tailwind tokens |
| 4. Typography | 3/4 | Consistent Montserrat display font; 4 weights used (bold, black, semibold, medium) but coherent |
| 5. Spacing | 3/4 | Consistent Tailwind scale usage; some arbitrary pixel values for micro-adjustments |
| 6. Experience Design | 4/4 | Loading skeletons, error boundaries, empty states, disabled states, optimistic updates all present |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **Hardcoded `#09090b` throughout components** -- If the background colour ever changes, dozens of files break -- Replace all `#09090b` references with `bg-insound-bg` or a CSS custom property `var(--insound-bg)` to leverage the existing Tailwind token.

2. **Generic error messages in FollowButton and ReportModal** -- "Something went wrong" gives users no actionable guidance -- Differentiate network errors ("Check your connection") from auth errors ("Sign in to continue") in `FollowButton.tsx:111` and `ReportModal.tsx:69`.

3. **`<img>` tags used instead of `next/image` on artist/release pages** -- Missing image optimisation hurts LCP on profile and release pages -- Replace `<img>` with `next/image` in `ArtistProfileClient.tsx` (lines 259, 271, 370, 447, 521, 666), `ReleaseClient.tsx` (line 411), `MerchCard.tsx` (line 21), and `PlayerBar.tsx` (lines 313, 479, 568). The eslint-disable comments already acknowledge this debt.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Strengths:**
- CTAs are contextual and specific: "Buy for [price]", "Pre-order", "Add all to basket", "Share an update"
- Empty states are well-crafted: "No releases yet. Check back soon." with a follow-up action link (ArtistProfileClient.tsx:697)
- Error states provide distinct messages: "Already purchased" vs "Something's off" vs "Still finalising..." (ReleaseClient.tsx:132-201)
- Follow button shows contextual label changes: "Follow" / "Following" / "Unfollow" on hover (FollowButton.tsx:77)
- Report modal uses specific category labels rather than generic options (ReportModal.tsx:7-17)
- PWYW pricing explains minimum clearly: "Minimum [price]" with fee breakdown

**Issues:**
- `FollowButton.tsx:111` -- "Something went wrong" is generic; should differentiate network vs server errors
- `ReportModal.tsx:69` -- "Something went wrong. Please try again." is vague for the error state
- `DiscographyClient.tsx:321` -- Same generic "Something went wrong." fallback
- `app/[slug]/error.tsx:8` and `app/release/error.tsx:8` -- Both use identical "Something went wrong." with "We couldn't load this page/release" -- adequate but could be more helpful

**Mobile notes:** Copy truncation handled well with `truncate` classes on track titles and artist names.

### Pillar 2: Visuals (4/4)

**Strengths:**
- Clear visual hierarchy on artist profile: banner -> avatar -> name (4xl/5xl font-black) -> bio -> releases
- Release page uses proper two-column layout on desktop with constrained cover art (w-40 to w-64)
- PlayerBar has distinct desktop (bottom bar with waveform scrubber) and mobile (collapsed/expanded with swipe-to-dismiss) treatments
- Interactive track list shows playing state with animated bars (ArtistProfileClient.tsx:583-587)
- Hover states on track rows reveal play icon replacing track number (ArtistProfileClient.tsx:594-599)
- ViewToggle provides compact/expanded modes for discography
- Badge component uses shield icon with colour-coded pill (Badge.tsx:36-48)
- VerifiedTick has informative tooltip on hover (VerifiedTick.tsx:32-37)
- Cover art fallbacks use deterministic seeded gradients -- never a broken image
- Merch card has "Sold out" overlay state (MerchCard.tsx:29-32)

**Mobile responsive behaviour:**
- Artist header stacks vertically on mobile, horizontal on sm+ (ArtistProfileClient.tsx:267)
- Release type labels hidden on mobile, visible on md+ (ArtistProfileClient.tsx:378)
- Buy button hidden on mobile in compact view, only shown on sm+ (ArtistProfileClient.tsx:423)
- PlayerBar has completely separate mobile view with expandable state and swipe gestures (PlayerBar.tsx:442-607)
- Discography has mobile bottom nav replacing sidebar (DiscographyClient.tsx:511-516)
- Singles grid adapts: 2 cols mobile, 3 sm, 4 md (ArtistProfileClient.tsx:655)

**Icon-only button accessibility:**
- Share button has `aria-label="Share"` (ArtistProfileClient.tsx:304)
- Report button has `aria-label="Report profile"` (ArtistProfileClient.tsx:314)
- Play buttons have `aria-label="Play"` (ArtistProfileClient.tsx:417, 486)
- FavouriteButton has `aria-label` for both states (FavouriteButton.tsx:62)
- AddToBasketButton icon variant has `aria-label` (AddToBasketButton.tsx:61)
- PlayerBar scrubber has proper `role="slider"` with aria-value attributes (PlayerBar.tsx:394-399)

### Pillar 3: Color (3/4)

**Strengths:**
- Dynamic accent colour system via `resolveAccent()` -- each artist can have their own accent
- Accent used purposefully: price display, play buttons, CTA backgrounds, active states
- ColourPicker offers 15 curated vibrant colours all accessible on dark background (ColourPicker.tsx:7-22)
- 60/30/10 split works well: zinc-950 background (60%), zinc-800/900 surfaces (30%), artist accent (10%)
- Accent never used for decorative elements -- always functional (price, play, buy)

**Issues:**
- `#09090b` hardcoded in 15+ locations across files instead of using the `insound-bg` Tailwind token:
  - `ArtistProfileClient.tsx:134,261,262`
  - `error.tsx` files (both routes)
  - `loading.tsx:9`
  - `DiscographyClient.tsx:369`
  - `SocialLinks.tsx:43`
  - `MerchItemClient.tsx:152,164`
- `#141414` hardcoded for hover backgrounds (ArtistProfileClient.tsx:366,443) instead of `bg-zinc-900` or similar token
- `#F56D00` hardcoded in `SoundTagSelector.tsx:59,66,78` and `ReleaseClient.tsx:335` and `DiscographyClient.tsx:414` instead of using the `insound-orange` / `orange-600` token
- `#000` used for button text colour on accent backgrounds (ArtistProfileClient.tsx:419,488,618) -- should use `text-black` Tailwind class
- SVG fills use hardcoded colours like `#999` and `#52525b` (SocialLinks.tsx:39, VerifiedTick.tsx:27-28)

### Pillar 4: Typography (3/4)

**Font sizes in use:** text-xs, text-sm, text-base, text-lg, text-xl, text-2xl, text-3xl, text-4xl, text-5xl (9 sizes)

**Font weights in use:** font-medium, font-semibold, font-bold, font-black (4 weights)

**Assessment:**
- 9 font sizes is above the typical 4-size recommendation, but the usage pattern is intentional and hierarchical:
  - `text-4xl/5xl` -- page titles only (artist name, release title)
  - `text-2xl/3xl` -- section headings, prices
  - `text-lg/xl` -- modal headings, sub-headings
  - `text-sm/base` -- body text, track titles
  - `text-xs` -- metadata, timestamps, labels
  - `text-[10px]` and `text-[9px]` -- micro-labels (section headers like "DISCOGRAPHY", "SINGLES", badge labels)
- 4 weights is within acceptable range: `font-black` for display headings, `font-bold` for emphasis, `font-semibold` for interactive elements, `font-medium` for secondary text
- `font-display` class used consistently for headings, mapping to Montserrat
- Micro-label pattern (`text-[10px] font-black uppercase tracking-widest`) is used consistently as a design system pattern for section headers -- good cohesion

**Mobile behaviour:** Font sizes scale appropriately with `md:` prefixes (e.g., `text-4xl md:text-5xl` for artist name).

### Pillar 5: Spacing (3/4)

**Strengths:**
- Consistent use of Tailwind spacing scale throughout
- Page containers use `px-6 md:px-12` pattern consistently
- Max-width containers are consistent: `max-w-5xl` for profiles, `max-w-4xl` for releases, `max-w-lg` for modals
- Section spacing uses consistent `mb-8` / `mb-10` pattern
- Gap utilities used consistently: `gap-3`, `gap-4`, `gap-6` for layout

**Arbitrary values found:**
- `[10px]` used extensively for micro-label font sizes (not spacing, acceptable)
- `[9px]` used for tag text sizes
- `[0.06]`, `[0.08]`, `[0.12]`, `[0.15]`, `[0.04]` opacity values in ring/bg classes -- these are for subtle UI effects and acceptable
- No concerning arbitrary spacing values (`[Npx]` or `[Nrem]`) for padding/margin

**Mobile notes:** Padding adjusts from `px-6` to `md:px-12` consistently. The player bar correctly positions at `bottom-[60px]` on mobile to account for the bottom nav bar.

### Pillar 6: Experience Design (4/4)

**Loading states:**
- `app/[slug]/loading.tsx` -- Full skeleton with banner, avatar, name, bio, and release grid placeholders
- `app/release/loading.tsx` -- Skeleton with cover art, metadata, price, and tracklist placeholders
- `app/release/page.tsx` -- Suspense boundary wrapping the inner component (line 141)
- Checkout flow shows spinner with "Preparing your download..." message (ReleaseClient.tsx:256-263)
- Upload progress shows step-by-step: "Creating release...", "Uploading cover art...", "Uploading track N of M..." (DiscographyClient.tsx:226-298)
- FollowButton shows disabled state during loading (FollowButton.tsx:88)

**Error states:**
- `app/[slug]/error.tsx` -- Error boundary with retry button
- `app/release/error.tsx` -- Error boundary with retry button
- Checkout handles: "Already purchased", "Payment system unavailable", "Still finalising..." (ReleaseClient.tsx:132-201)
- FollowButton shows error tooltip with auto-dismiss (FollowButton.tsx:108-113)
- FavouriteButton shows "Failed to save" error tooltip (FavouriteButton.tsx:84-88)
- PostComposer shows inline error (PostComposer.tsx:90)
- ReportModal handles 5 result states: success, duplicate, limit, auth, error (ReportModal.tsx:64-70)

**Empty states:**
- Artist with no releases: icon + "No releases yet" + "Check back soon." + "Upload your first release" CTA (ArtistProfileClient.tsx:690-705)
- Discography with no releases: "No releases yet. Click 'New Release' to get started." (DiscographyClient.tsx:445-446)
- Fan profile handles missing collection/wall gracefully via conditional rendering (FanProfileClient.tsx:106-121)

**Disabled/confirmation states:**
- "Add all to basket" disables when all already in basket (ArtistProfileClient.tsx:336-338)
- Buy button disables when below minimum price (ReleaseClient.tsx:591-592)
- Delete release requires `confirm()` dialog (DiscographyClient.tsx:344)
- Digital content consent checkbox required before download access (ReleaseClient.tsx:271-303)
- AddToBasketButton shows "In basket" disabled state (AddToBasketButton.tsx:36-39)

**Optimistic updates:**
- FollowButton updates count immediately, rolls back on error (FollowButton.tsx:48-50)
- FavouriteButton uses Zustand store for instant toggle (FavouriteButton.tsx:46-48)

**Keyboard/touch interaction:**
- PlayerBar scrubber supports arrow keys, Home, End (PlayerBar.tsx:208-231)
- Expanded mobile player supports swipe-to-dismiss with velocity detection (PlayerBar.tsx:237-283)
- Mobile player collapsed view has keyboard support via `onKeyDown` (PlayerBar.tsx:564)

---

## Files Audited

- `app/[slug]/ArtistProfileClient.tsx`
- `app/[slug]/FanProfileClient.tsx`
- `app/[slug]/page.tsx`
- `app/[slug]/loading.tsx`
- `app/[slug]/error.tsx`
- `app/[slug]/components/WallPost.tsx`
- `app/release/ReleaseClient.tsx`
- `app/release/page.tsx`
- `app/release/loading.tsx`
- `app/release/error.tsx`
- `app/discography/DiscographyClient.tsx`
- `app/discography/page.tsx`
- `app/components/PlayerBar.tsx`
- `app/components/ui/FollowButton.tsx`
- `app/components/ui/FavouriteButton.tsx`
- `app/components/ui/SocialLinks.tsx`
- `app/components/ui/Badge.tsx`
- `app/components/ui/VerifiedTick.tsx`
- `app/components/ui/ReleaseCard.tsx`
- `app/components/ui/MerchCard.tsx`
- `app/components/ui/AddToBasketButton.tsx`
- `app/components/ui/ViewToggle.tsx`
- `app/components/ui/PostComposer.tsx`
- `app/components/ui/ReportModal.tsx`
- `app/components/ui/SoftNudge.tsx`
- `app/components/ui/SoundTagSelector.tsx`
- `app/components/ui/GenreMoodBoard.tsx`
- `app/components/ui/ColourPicker.tsx`
- `app/components/ui/ImageUploader.tsx`
- `app/components/ui/SocialAccountsEditor.tsx`
- `app/components/ui/StatCard.tsx`
- `tailwind.config.js`
