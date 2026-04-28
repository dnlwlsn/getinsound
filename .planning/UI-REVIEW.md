# Insound — Full Product UI Review

**Audited:** 2026-04-28
**Baseline:** Abstract 6-pillar standards (no UI-SPEC exists)
**Scope:** Entire product — desktop (1440x900) + mobile (375x812)
**Screenshots:** Partially captured (public pages only; auth-protected pages redirect)

---

## Pillar Scores (Aggregate)

| Pillar | Core Pages | Profiles/Releases | Dashboard/Auth | **Average** |
|--------|-----------|-------------------|----------------|-------------|
| 1. Copywriting | 3/4 | 3/4 | 3/4 | **3.0/4** |
| 2. Visuals | 4/4 | 4/4 | 3/4 | **3.7/4** |
| 3. Color | 3/4 | 3/4 | 3/4 | **3.0/4** |
| 4. Typography | 3/4 | 3/4 | 3/4 | **3.0/4** |
| 5. Spacing | 3/4 | 3/4 | 3/4 | **3.0/4** |
| 6. Experience Design | 4/4 | 4/4 | 3/4 | **3.7/4** |

**Overall: 19.3/24 (~80%)**

---

## Top 5 Priority Fixes (Cross-Product)

1. **Generic "Something went wrong" error messages in 15+ locations** — Users get no actionable guidance on what failed or what to do. Appears in AuthClient, LibraryClient, FollowButton, ReportModal, RedeemClient, DashboardClient, UnsubscribeClient, BecomeArtistClient, and more. Replace with context-specific messages per component.

2. **184+ hardcoded hex/rgb color values bypass Tailwind tokens** — `#09090b` appears in 15+ files instead of `bg-insound-bg`; `#F56D00` used raw instead of `bg-orange-600`/`text-insound-orange`; `#141414` and `#181818` used for hover states instead of `bg-zinc-900`. This creates maintenance risk if brand colors change.

3. **Montserrat weight 900 (font-black) not loaded but heavily used** — `layout.tsx` loads weights [400, 600, 700] but `font-black` (900) is the most-used weight class across the product. Browsers synthesize this weight, which looks poor on some systems. Add `'900'` to the Montserrat font config.

4. **Raw `<img>` tags instead of `next/image` on key pages** — ArtistProfileClient (6 instances), ReleaseClient, MerchCard, and PlayerBar all use `<img>` with eslint-disable comments. Missing image optimization (lazy loading, srcset, format negotiation) hurts LCP on the most-visited pages.

5. **Admin delete actions lack confirmation dialogs** — AdminStats.tsx detail modal delete button, "Mark as delivered", and "Confirm return" all trigger irreversible actions on a single click. Only pre-order cancel has a confirmation modal.

---

## Strengths

- **Strong brand voice** — CTAs are specific ("Buy for $X", "Start selling your music"), empty states are contextual, FAQ copy is conversational
- **Excellent visual hierarchy** — Clear focal points, polished hover states, consistent card-based layouts
- **Disciplined accent system** — Orange-600 used purposefully on CTAs, prices, and active states; never decorative
- **Comprehensive state coverage** — Loading skeletons, error boundaries, empty states, disabled states, and optimistic updates across all major flows
- **Solid accessibility** — Skip-to-content link, aria-labels on icon buttons, keyboard navigation on player, focus traps on drawers/modals
- **Thoughtful responsive design** — Separate mobile player with swipe gestures, bottom nav for mobile, full-width dropdowns, adaptive grid layouts
- **Dynamic accent system** — `resolveAccent()` lets each artist have their own accent color

---

## Detailed Findings by Pillar

### Copywriting (3.0/4)

**What works:** Brand voice is consistent and personality-rich. CTAs are action-oriented. Empty states tell users what to do next. Report modal uses specific category labels. Follow button changes label contextually.

**What needs work:**
- "Something went wrong. Please try again." is the default error in 15+ components — differentiate network vs auth vs server errors
- Error pages (`error.tsx`) across routes use identical copy
- "Cancel" used for both navigation and destructive actions (modal close vs cancel pre-order)

### Visuals (3.7/4)

**What works:** Homepage hero, explore featured layout, artist profile banner-to-content flow, player bar with distinct desktop/mobile treatments, skeleton loaders that match final layouts, ViewToggle compact/expanded modes.

**What needs work:**
- Dead NavBar.tsx component (AppNav.tsx is the actual nav)
- Dashboard sidebar code duplicated between DashboardClient and SalesClient
- DashboardClient sidebar uses `<a>` tags; SalesClient uses `<Link>`

### Color (3.0/4)

**What works:** 60/30/10 split (dark bg / zinc text / orange accent) is well-maintained. Status badges use semantic colors (green/blue/yellow/red/purple). ColourPicker offers 15 curated accessible colors.

**What needs work:**
- `#09090b` hardcoded in 15+ files — should be `bg-insound-bg`
- `#F56D00` hardcoded in SoundTagSelector, ReleaseClient, DiscographyClient — should be `text-insound-orange`
- `#141414` / `#181818` hover states — should be `bg-zinc-900`
- SVG fills use hardcoded `#999`, `#52525b` — should use currentColor or Tailwind tokens
- UnsubscribeClient uses inline styles for brand colors

### Typography (3.0/4)

**What works:** Single font family (Montserrat) for both display and body. Micro-label pattern (`text-[10px] font-black uppercase tracking-widest`) is consistent as a design system element. Font sizes scale appropriately with responsive breakpoints.

**What needs work:**
- **Critical:** font-black (900 weight) not loaded in font config — browser synthesizes it
- 6 arbitrary font sizes (`text-[8px]` through `text-[15px]`) alongside standard Tailwind sizes
- 5 font weights in active use — `font-semibold` could likely consolidate into `font-bold`

### Spacing (3.0/4)

**What works:** Consistent max-width containers (`max-w-7xl` app / `max-w-4xl` landing / `max-w-2xl` prose). Responsive padding pattern `px-5 md:px-10`. Gap utilities used consistently.

**What needs work:**
- Header bottom margin inconsistent: `mb-12` (Dashboard) vs `mb-8` (Library) vs `mb-10` (Sales)
- AppNav signed-out uses `max-w-6xl` while signed-in uses `max-w-7xl`
- Padding inconsistency: some pages use `p-8 md:p-12` (all sides), others use `py-8 sm:py-12` (y-only)

### Experience Design (3.7/4)

**What works:** Loading skeletons on all major pages. Error boundaries per route. Empty states with contextual CTAs. Disabled states during async ops. Optimistic updates (follow, favourite). PWA install banner, notification opt-in, splash screen. Cookie consent with three tiers. Player keyboard navigation + swipe gestures.

**What needs work:**
- Admin delete has no confirmation (single-click deletes artists/releases)
- "Mark as delivered" and "Confirm return" have no confirmation
- Notifications page uses spinner instead of skeleton
- GenreOnboarding uses `window.location.href` instead of `router.push()`
- Download modal missing `role="dialog"` and `aria-modal="true"`
- Admin pages lack aria-labels on interactive elements

---

## Files Audited

**100 files across 3 audit groups** covering all routes in `/app`, all shared components in `/app/components`, and the Tailwind configuration.

See detailed file lists in:
- `.planning/00-core-UI-REVIEW.md` (37 files)
- `.planning/01-profiles-UI-REVIEW.md` (32 files)
- `.planning/02-dashboard-UI-REVIEW.md` (33 files)
