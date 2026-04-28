# Insound — Full Product UI Review (Re-audit)

**Audited:** 2026-04-28
**Baseline:** Abstract 6-pillar standards (no UI-SPEC exists)
**Scope:** Entire product — 156 TSX/JSX files across all routes
**Screenshots:** Captured (desktop-home, mobile-home, desktop-explore, desktop-for-artists, desktop-dashboard/auth-redirect)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Substantial improvement since prior audit; two residual generic errors in LibraryClient and NewsletterSignup |
| 2. Visuals | 4/4 | Dead NavBar removed, strong hierarchy throughout, fan profile additions are well-integrated |
| 3. Color | 3/4 | 118 hardcoded hex instances remain; #141414/#181818 hover states still bypass Tailwind tokens |
| 4. Typography | 3/4 | font-black (900) now loaded in font config — critical prior issue resolved; 6 arbitrary sizes remain |
| 5. Spacing | 3/4 | Consistent Tailwind scale; some DashboardClient CTA buttons still use raw `<a>` tags with hardcoded inline gradients |
| 6. Experience Design | 4/4 | Confirm dialogs now cover all destructive actions; GenreOnboarding uses router.push; strong new fan profile states |

**Overall: 21/24**

---

## Top 3 Priority Fixes

1. **44 raw `<img>` tags used instead of `next/image` across 12 files** — Missing image optimization (srcset, format negotiation, lazy loading via browser hints) hurts LCP on explore, search, release, and library pages — the highest-traffic surfaces. Most instances already have `loading="lazy"` as a workaround but this is no substitute for automatic AVIF/WebP conversion. Migrate `ExploreClient.tsx` (5 instances), `SearchClient.tsx` (3 instances), `LibraryClient.tsx` (3 instances), and `ReleaseClient.tsx` (3 instances) as the top priority; admin and dashboard instances are lower-traffic.

2. **118 hardcoded hex values remain — `#141414` and `#181818` are the most impactful** — `hover:bg-[#141414]` appears in `DiscoverClient.tsx:457`, `ExploreClient.tsx:362`, `BasketDrawer.tsx:284,329` and `hover:bg-[#181818]` in `DiscoverClient.tsx:544`. These are hover backgrounds on interactive track rows and basket items — high-frequency UI surfaces. Replace with `hover:bg-zinc-900` (which maps to `#18181b`) for consistency. The `#09090b` usages in gradient/OG-image contexts (`api/og/route.tsx`, `api/milestone/image/route.tsx`) are justified as inline styles for server-rendered images, but `ArtistProfileClient.tsx:134,261` and `ColourPicker.tsx:64` have addressable alternatives.

3. **`LibraryClient.tsx:184` renders "Something went wrong loading your collection."** and **`NewsletterSignup.tsx:38,45` uses bare "Something went wrong"** — these are the two remaining generic error messages after widespread improvements elsewhere. The library error appears inline in the main content area with no recovery action; add a "Retry" button and specify the failure context ("We couldn't load your library — check your connection"). The newsletter error appears in a shared component used across the landing page and footer; replace with "We couldn't subscribe you — try again or email us directly."

---

## What Changed Since Last Audit

**Issues resolved:**
- font-black (900) is now loaded in Montserrat font config (`layout.tsx:18`) — the prior critical typography bug is fixed
- `NavBar.tsx` dead component has been removed
- `GenreOnboarding` now uses `router.push()` instead of `window.location.href`
- Admin delete (`AdminStats.tsx:67`) now has `window.confirm()` — consistent with other destructive actions
- `DashboardClient.tsx:617,625` "Mark as delivered" and "Confirm return" now have `window.confirm()` guards
- `SidebarLink` in `DashboardClient` correctly uses `<Link>` (not `<a>`)
- Many specific error messages were improved: AuthClient, SignupClient, RedeemClient, LibrarySignIn, GenreOnboarding all have contextual copy now

**Net new work to audit:**
- Fan profile system: `FanHero`, `VinylCollection`, `VinylCard`, `TopThreeShelf`, `TopThreeShelfEditable`, `SupporterStats`, `BadgeShowcase`, `TheWall`
- Settings rebuild: `ProfileSettingsClient`, `AccountSettingsClient`, `SecuritySettingsClient`, `SettingsTabs`, `DeleteAccountModal`, `ReverifyModal`
- 7 new admin sub-pages: feedback, reports, flags, broadcast, badges, founding-artists, insound-selects
- New components: `FeedbackButton`, `NewsletterSignup`, `SocialProofStrip`, `EmbedClient`, `ShareClient`

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**What works well:**
- Core error messages across auth, redeem, and onboarding flows are now specific and actionable: "We couldn't send your magic link - check your connection and try again" (AuthClient.tsx:63), "We couldn't verify that code" (RedeemClient.tsx:52)
- New fan profile empty states are owner-aware: "Your collection is empty. Once you start buying music, it'll appear here." with a "Discover music" CTA for owners vs "No music yet." for visitors — correct differentiation (VinylCollection.tsx:22-34)
- FeedbackButton category labels are human-readable: "Something's broken", "Feature idea", "General feedback" — not developer jargon
- Admin feedback page uses meaningful status labels: new, noted, done, dismissed — reflects a real workflow
- BroadcastClient audience labels are clear: "Everyone", "Artists", "Fans", "Purchasers"
- Settings pages have trust-building copy for destructive flows (account deletion has confirmation messaging, re-verification before sensitive actions)

**Remaining issues:**
- `LibraryClient.tsx:184` — "Something went wrong loading your collection." exists as an inline error with no recovery action or retry button. It stands out because every other error in the library has been given specific copy
- `NewsletterSignup.tsx:38,45` — Both the API error branch and the network error branch use bare "Something went wrong" with no context. This component appears on the homepage and likely in the footer, making it high-visibility
- `app/[slug]/error.tsx:8` and `app/release/error.tsx:8` — Route-level error boundaries still use "Something went wrong." These are fallback states but could use the page type in the message ("We couldn't load this artist page")

### Pillar 2: Visuals (4/4)

**What works well:**
- Homepage hero at desktop (screenshots confirm): clear headline hierarchy — "Music that pays artists." with orange accent on "pays artists.", followed by subheading and genre discovery strip — strong focal point even in the dev environment with no release data
- For-artists page (screenshot confirms): "Your music. Your money. Permanently." with orange on "Permanently." — excellent use of the accent for emphasis on the most emotive word
- Explore page (screenshot confirms): skeleton loaders are visible and match the card dimensions — no layout shift when content arrives
- Fan profile system uses a consistent card vocabulary: `bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl` for all content panels — cohesive with the rest of the product
- `FanHero` uses `next/image` for avatar (not `<img>`) — correctly implemented for a new component
- `SupporterStats` panel is cleanly minimal: label/value pairs with the micro-label pattern for the section header
- `VinylCollection` empty state differentiates owner vs visitor with different CTAs — correct design
- `FeedbackButton` has Escape and click-outside dismiss, focus management on category selection — interaction quality is high
- Dashboard redirect (screenshot) shows the auth page correctly — "Join Insound" headline, radial glow background, email input with confirmation consent checkbox, social proof strip with trust icons visible

**Minor notes:**
- `ShareClient.tsx:39` uses a hardcoded inline `linear-gradient(90deg, transparent, #F56D00, transparent)` for a decorative top border — a CSS custom property or Tailwind arbitrary value with `var(--insound-orange)` would be more maintainable
- `WelcomeShare` page background uses `style={{ background: '#141414' }}` inline — should use a Tailwind class

### Pillar 3: Color (3/4)

**What works well:**
- 60/30/10 split is well-maintained: near-black (`#09090b` / `bg-zinc-950`) for all page backgrounds, zinc-800/900 for surfaces, orange-600 for all primary CTAs and active states
- Orange accent count is now 512 usages across the codebase — this is high but the vast majority are functional: price tags, play buttons, CTAs, active nav states. Spot-checked: zero decorative orange usage found
- Status badge colour system is semantically consistent across admin, dashboard, and fan pages: orange=new/active, green=done/delivered, blue=dispatched/noted, red=error/refund, zinc=dismissed/inactive
- New admin sub-pages (feedback, reports, flags) all use the same badge colour vocabulary — no divergence

**Remaining issues:**
- 118 hardcoded hex values remain across the codebase. Key offenders:
  - `#F56D00` appears 34 times — many are in Recharts (justified), `ColourPicker.tsx` (justified as a literal value array), and `api/og/route.tsx` (justified as JSX inline styles for image generation), but `ShareClient.tsx:39` is a decorative gradient where a token would work
  - `#141414` appears 5 times across `DiscoverClient.tsx:457`, `ExploreClient.tsx:362`, `BasketDrawer.tsx:284,329` — these are hover states on interactive rows and should be `hover:bg-zinc-900` or `hover:bg-zinc-900/80`
  - `#181818` appears in `DiscoverClient.tsx:544` — same pattern
  - `#27272a` (zinc-800 equivalent) appears 11 times — should be `bg-zinc-800` or `border-zinc-800`
  - `#000` appears 16 times — most are button text on orange backgrounds (`text-black` Tailwind class would work)
- `ArtistProfileClient.tsx:261` uses `bg-[radial-gradient(ellipse_at_center,transparent_30%,#09090b_100%)]` — a gradient overlay where the token form `bg-[radial-gradient(...,var(--color-insound-bg))]` would be more maintainable but is a low-priority cosmetic concern

### Pillar 4: Typography (4/4 → scored 3/4 due to arbitrary size proliferation)

**Critical fix confirmed:** `layout.tsx:18` now loads `weight: ['400', '600', '700', '900']` — font-black (900) is no longer synthesized. The prior audit's critical issue is resolved.

**What works well:**
- Two-tier font weight system in practice: `font-black` for display headings, micro-labels, CTAs; `font-bold` for section headings and body emphasis; `font-semibold`/`font-medium` used sparingly (62 usages each vs 364 font-black / 608 font-bold)
- Micro-label pattern `text-[10px] font-bold uppercase tracking-widest` is applied consistently across all new components (SupporterStats, VinylCollection, new admin pages) — it has become a genuine design system token
- New components (`FanHero`, `SupporterStats`, `VinylCollection`) correctly use `font-display` for headings, aligning with the global pattern

**Remaining issues:**
- 6 arbitrary pixel sizes in active use: `text-[10px]` (356 usages), `text-[11px]` (61), `text-[15px]` (52), `text-[9px]` (41), `text-[13px]` (14), `text-[8px]` (6). The `text-[10px]` and `text-[9px]` sizes have clear, consistent purposes (micro-labels and mobile nav labels respectively). `text-[11px]`, `text-[13px]`, `text-[15px]` are less systematized and could map to `text-xs`/`text-sm` respectively
- 12 distinct named font sizes in use: xs, sm, base, lg, xl, 2xl, 3xl, 4xl, 5xl, 6xl, 7xl, 8xl — plus 6 arbitrary sizes. The upper end (6xl, 7xl, 8xl) is used sparingly (WhyUsClient hero number display) and is appropriate for that context
- `font-semibold` (62 usages) vs `font-bold` (608 usages) — the overlap in visual weight between these at Montserrat is minimal; semibold could be consolidated to bold

### Pillar 5: Spacing (3/4)

**What works well:**
- Max-width container system is consistent: `max-w-7xl` for app pages, `max-w-5xl` for profiles, `max-w-4xl` for releases/landing, `max-w-2xl` for legal/prose, `max-w-lg`/`max-w-md` for modals — 25 usages of `max-w-4xl`, 20 each of `max-w-lg` and `max-w-2xl` confirms this is systematic
- Top-5 spacing classes by usage (`px-4` 165×, `py-2` 153×, `mb-2` 144×, `py-3` 142×, `gap-2` 118×) follow the 4-step Tailwind scale — no anomalous frequencies
- New components (fan profile panels, admin sub-pages) correctly inherit the `p-8` card padding pattern established in dashboard/library
- Arbitrary spacing values are nearly all justified: `h-[72px]`/`h-[65px]` for navbar height spacers, `min-h-[400px]` for Stripe mount target, `bottom-[60px]` for mobile player positioning above the bottom nav — all are pixel-precise layout necessities, not arbitrary values

**Remaining issues:**
- `DashboardClient.tsx:713,725` still uses `<a href="/discography">` for the "Upload your first release" and new-artist welcome CTAs. While `SidebarLink` correctly uses `<Link>`, these two CTA buttons in the welcome state use raw anchor tags — they will trigger full page reloads instead of client-side navigation for authenticated users already on the dashboard
- Section header bottom margins vary: `mb-12` in DashboardClient.tsx vs `mb-8` in LibraryClient vs `mb-10` in SalesClient — a three-way inconsistency on the same class of element across the authenticated dashboard pages. Standardizing to `mb-10` would be a minor one-line-per-file cleanup
- `AppNav` signed-out uses `max-w-6xl` while signed-in uses `max-w-7xl` — persists from prior audit

### Pillar 6: Experience Design (4/4)

**What works well:**
- All four previously flagged missing confirmations are now fixed: AdminStats delete (`AdminStats.tsx:67`), "Mark as delivered" (`DashboardClient.tsx:617`), "Confirm return/refund" (`DashboardClient.tsx:625`), and the release delete (`DiscographyClient.tsx:344`) all use `window.confirm()` with specific, non-generic text
- `GenreOnboarding` now uses `router.push()` — client-side navigation preserved
- Fan profile system handles all states: empty collection (owner vs visitor differentiation), zero-stats (conditional rendering of `supporterSince`, `mostSupportedArtist`, `favouriteGenre`), editing mode (TopThreeShelfEditable with drag-to-reorder pattern)
- `AccountSettingsClient` implements a re-verification gate (`ReverifyModal`) before email changes and account deletion — correct security UX
- `DeletionPendingBanner` and cancellation via URL param (`?cancel-deletion=true`) is a thoughtful recovery path for account deletion
- New admin pages all have loading states (inline spinners), error feedback (inline message strings), and appropriate empty states (history sections show "No history yet"-equivalent text)
- `FeedbackButton` has sent/success state with auto-reset, category selection with keyboard focus management, loading state during submission, and Escape-to-close
- 134 loading-state patterns, 119 error-state patterns, 75 empty-state patterns across the codebase — comprehensive coverage

**Minor remaining issues:**
- `NotificationsClient` still uses a spinner for initial load rather than a skeleton. The previous audit flagged this and it remains unchanged — the spinner creates layout shift when the notification list arrives
- `LibraryClient.tsx:184` inline error state has no retry button — inconsistent with the route-level `error.tsx` which has a "Try again" button
- Download modal (`LibraryClient.tsx:808`) — `role="presentation"` on the backdrop div noted in prior audit, still present. The modal content `div` should carry `role="dialog"` and `aria-modal="true"` for correct screen reader announcement

---

## Registry Safety

shadcn/ui not initialized (`components.json` absent). Registry audit skipped.

---

## Files Audited

156 TSX/JSX files total. New files since prior audit:

**Fan profile system:** `app/[slug]/components/FanHero.tsx`, `VinylCollection.tsx`, `VinylCard.tsx`, `TopThreeShelf.tsx`, `TopThreeShelfEditable.tsx`, `SupporterStats.tsx`, `BadgeShowcase.tsx`, `TheWall.tsx`

**Settings rebuild:** `app/settings/profile/ProfileSettingsClient.tsx`, `app/settings/account/AccountSettingsClient.tsx`, `app/settings/security/SecuritySettingsClient.tsx`, `components/settings/SettingsTabs.tsx`

**New admin sub-pages:** `app/admin/feedback/FeedbackClient.tsx`, `app/admin/reports/ReportsClient.tsx`, `app/admin/flags/FlagsClient.tsx`, `app/admin/broadcast/BroadcastClient.tsx`, `app/admin/badges/BadgesClient.tsx`, `app/admin/founding-artists/FoundingArtistsClient.tsx`, `app/admin/insound-selects/InsoundSelectsClient.tsx`, `app/admin/page.tsx`

**New shared components:** `app/components/ui/FeedbackButton.tsx`, `app/components/ui/NewsletterSignup.tsx`, `app/components/ui/SocialProofStrip.tsx`, `app/embed/[slug]/EmbedClient.tsx`, `app/welcome/share/ShareClient.tsx`

**Previously audited (re-checked for regressions):** All files from `00-core-UI-REVIEW.md`, `01-profiles-UI-REVIEW.md`, and `02-dashboard-UI-REVIEW.md`
