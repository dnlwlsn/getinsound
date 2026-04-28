# Phase 2 -- UI Review (Authenticated User Pages)

**Audited:** 2026-04-28
**Baseline:** Abstract 6-pillar standards (no UI-SPEC exists)
**Screenshots:** Partially captured (library and settings redirected to auth; become-an-artist captured but redirected to signup for unauthenticated user)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Strong contextual copy throughout; some generic "Something went wrong" messages could be more specific |
| 2. Visuals | 3/4 | Clean dark UI with consistent card hierarchy; sidebar+bottom-nav pattern works well across viewports |
| 3. Color | 3/4 | Excellent accent discipline with orange-600 (#F56D00); hardcoded hex in AnalyticsCharts is justified for Recharts |
| 4. Typography | 3/4 | Consistent font-black/bold weight system with Montserrat; text-[10px] and text-[9px] micro labels are a strong brand pattern |
| 5. Spacing | 3/4 | Good use of Tailwind scale; very few arbitrary values; consistent section/card spacing |
| 6. Experience Design | 3/4 | Loading, error, and empty states covered across all pages; disabled states present; destructive actions have confirmation |

**Overall: 18/24**

---

## Top 3 Priority Fixes

1. **"Something went wrong" used in 7+ locations without differentiation** -- Users cannot self-diagnose issues -- Replace with specific messages: "We couldn't load your dashboard right now" (dashboard/page.tsx:183), "Download failed, please check your connection" (LibraryClient.tsx:799), "We couldn't process that code" (RedeemClient.tsx:52, 81)

2. **Admin detail modal delete button has no confirmation dialog** -- Accidental deletions of artists/fans/releases/waitlist entries are irreversible -- Add `window.confirm()` before `deleteRow()` in AdminStats.tsx:66, similar to the pattern already used in AdminFeatureFlags.tsx:22

3. **Notifications page lacks a loading skeleton matching the page layout** -- Spinner-only loading state creates layout shift when content loads -- Replace the spinner at NotificationsClient.tsx:132-134 with a skeleton matching the notification list structure (similar to the dashboard and library loading skeletons)

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Strengths:**
- CTAs are specific and action-oriented: "Upload Track", "Complete Stripe Setup", "Claim release", "Send magic link", "Yes, notify me"
- Empty states are contextual: "Nothing here yet. Find something you love." (LibraryClient.tsx:204-205), "No payouts yet. Earnings will be paid out automatically by Stripe." (SalesClient.tsx:137)
- Welcome banner for new artists is well-crafted (DashboardClient.tsx:711-721)
- Download format labels are descriptive: "WAV -- Original Quality", "FLAC -- Lossless Compressed" (LibraryClient.tsx:722-726)
- Redeem flow has trust indicators: "Secure", "Private", "Free" (RedeemClient.tsx:249-259)

**Issues:**
- "Something went wrong" appears 7 times as a generic catch-all (dashboard/page.tsx:183, LibrarySignIn.tsx:33, LibraryClient.tsx:958,989, RedeemClient.tsx:52,81, UnsubscribeClient.tsx:86, BecomeArtistClient.tsx:127)
- "Cancel" label used as both a navigation action and a destructive action (e.g., FormatSelectorModal cancel vs Cancel Pre-order) -- could confuse users
- LibraryClient.tsx:843 "Cancel" in format modal is fine but could be "Close" to distinguish from destructive cancel
- "Try again" button (dashboard/error.tsx:15, library/error.tsx:15) is good but could specify what will be retried

### Pillar 2: Visuals (3/4)

**Strengths:**
- Clear visual hierarchy: section headers use font-display with font-bold at text-lg, stat values at text-3xl/text-4xl with orange accent
- Dashboard sidebar pattern (hidden on mobile, sticky on desktop) is well-implemented with consistent nav structure across Dashboard and Sales
- Mobile bottom nav with icon+label pattern provides clear navigation (DashboardClient.tsx:1546-1551, SalesClient.tsx:176-193)
- Card-based section layout with consistent rounded-2xl, border-zinc-800 treatment
- Skeleton loading states faithfully match the final layout structure (dashboard/loading.tsx, library/loading.tsx)
- Release cards with hover overlay for Play/Download actions (LibraryClient.tsx:493-520)

**Issues:**
- SidebarLink in DashboardClient.tsx:1574-1580 uses `<a>` tags instead of `<Link>` for internal navigation -- inconsistent with SalesClient which uses `<Link>`
- Sidebar in SalesClient duplicates the sidebar code from DashboardClient instead of sharing a component
- Unsubscribe page (UnsubscribeClient.tsx) uses inline styles for background and brand color instead of Tailwind classes, creating visual inconsistency risk
- Admin page lacks mobile bottom nav -- admin is desktop-only but no explicit indication of this

### Pillar 3: Color (3/4)

**Strengths:**
- Orange accent (#F56D00/orange-600) is used consistently for: CTAs, active nav states, stat values, accent labels, focus borders
- 156 total orange accent class usages across audited files -- used purposefully on interactive elements, not decorative
- Status badge system uses semantic colors: green for active/delivered, blue for dispatched/in_transit, yellow for pending/return_requested, red for refund, purple for returned (DashboardClient.tsx:969-977, SalesClient.tsx:148-153, LibraryClient.tsx:311-319)
- Dark theme is consistent: bg-[#09090b] or bg-zinc-950 as page background, bg-zinc-900 for cards, bg-zinc-800 for secondary surfaces
- AnalyticsCharts hardcoded hex values (#F56D00, #27272a, #71717a, #18181b, #a1a1aa) are justified -- Recharts requires inline style objects

**Issues:**
- LibraryClient.tsx:587 uses `hover:bg-[#141414]` and line 686 uses `hover:bg-[#181818]` -- these should be bg-zinc-900 or bg-zinc-900/50 for consistency with the Tailwind palette
- UnsubscribeClient.tsx uses inline style `color: '#F56D00'` and `borderColor: 'rgba(245,109,0,0.3)'` instead of Tailwind orange classes (lines 63-65)
- `#a1a1aa` in LibraryClient.tsx:303 is the zinc-400 equivalent -- should use `text-zinc-400` class instead

### Pillar 4: Typography (3/4)

**Strengths:**
- Consistent type scale: text-[10px] for micro labels, text-xs for secondary info, text-sm for body, text-lg/text-xl for section titles, text-2xl-4xl for page headings
- Two-weight system is disciplined: font-black for headings/labels/CTAs, font-bold for body emphasis, font-medium/font-semibold used sparingly
- Montserrat (via font-display and font-sans) applied consistently
- text-[10px] + font-black + uppercase + tracking-widest is used as a consistent "micro label" pattern across all pages (section headers, stat labels, status badges)
- text-[9px] is reserved exclusively for mobile nav labels

**Issues:**
- Font sizes in use: xs, sm, base, lg, xl, 2xl, 3xl, 4xl, 5xl plus custom [10px], [9px], [11px], [13px] -- the custom pixel sizes are consistent but could be documented as a design token
- text-5xl appears in one file (LibraryClient.tsx:228) alongside text-3xl for the same heading at different breakpoints -- this is fine but the jump from 3xl to 5xl is large; 4xl might be smoother
- Font weights in use: normal (implicit), medium, semibold, bold, black -- 5 weights. This is within tolerance but semibold could likely be consolidated into bold

### Pillar 5: Spacing (3/4)

**Strengths:**
- Consistent section spacing: mb-6 between sections, mb-10 for major section groups, p-6/p-8 for card padding
- Responsive padding: `px-4 sm:px-8` (LibraryClient.tsx:221), `p-8 md:p-12` (DashboardClient.tsx:675)
- Grid gaps are consistent: gap-4 for stat grids, gap-3 for list items, gap-1/gap-2 for tight inline elements
- Loading skeletons match the spacing of their loaded counterparts

**Issues:**
- Arbitrary spacing values are minimal and justified: `text-[10px]`, `text-[9px]` are typography not spacing; tracking-[0.2em]/tracking-[0.3em] for micro labels
- `mb-12` used for header in DashboardClient.tsx:678 vs `mb-8` in LibraryClient.tsx:223 and `mb-10` in SalesClient.tsx:84 -- header bottom margin is inconsistent across pages
- NotificationsClient uses `py-8 sm:py-12` while LibraryClient uses `py-8 sm:py-12` -- consistent here, but SalesClient uses `p-8 md:p-12` (padding all sides vs y-only)

### Pillar 6: Experience Design (3/4)

**Strengths:**
- Loading states: 136 loading-related patterns found; dedicated loading.tsx files for dashboard and library; inline loading spinners for notifications, sales, download
- Error states: dedicated error.tsx files for dashboard and library with reset buttons; inline error handling in LibrarySignIn, RedeemClient, UnsubscribeClient, BecomeArtistClient
- Empty states: 39 empty state patterns; contextual messages in dashboard ("No releases yet"), library ("Nothing here yet. Find something you love."), notifications ("All caught up!"), wishlist ("Your wishlist is empty")
- Disabled states: 34 disabled state usages; buttons disable during async operations with opacity-50/opacity-40 treatment
- Destructive actions: Cancel pre-order has a confirmation modal (DashboardClient.tsx:1522-1539); Feature flag disable has window.confirm (AdminFeatureFlags.tsx:22)
- Optimistic UI: Merch toggle, order status updates, notification read state update immediately
- Download flow: Format selector modal with remembered preference (localStorage), ZIP for albums, progress states ("Zipping...", "Downloading...")
- PWA components: Install banner appears after 2nd visit, respects dismiss, handles iOS/Android differently; Notification opt-in has clear value prop and dismiss; PwaSplash has smooth animation sequence; ServiceWorkerRegistration is a clean effect-only component

**Issues:**
- Admin delete in DetailModal (AdminStats.tsx:66) has no confirmation -- single click deletes artists/fans/releases permanently
- confirmReturn (DashboardClient.tsx:617) triggers an order refund with no confirmation dialog -- only the pre-order cancel has a modal
- "Mark as delivered" (DashboardClient.tsx:1002) has no confirmation -- could be accidentally clicked
- GenreOnboarding.tsx:54 does a hard `window.location.href` redirect instead of `router.push()` -- loses client-side state
- Download modal (LibraryClient.tsx:808) uses `role="presentation"` on the backdrop but should use `role="dialog"` on the modal content div with `aria-modal="true"`
- Only 11 aria-label/aria-describedby/role attributes across all audited files -- interactive icon-only buttons in the admin and dashboard could benefit from more explicit labelling

---

## Files Audited

- app/dashboard/DashboardClient.tsx (1920+ lines)
- app/dashboard/AnalyticsCharts.tsx
- app/dashboard/page.tsx
- app/dashboard/loading.tsx
- app/dashboard/error.tsx
- app/library/LibraryClient.tsx (1001 lines)
- app/library/LibrarySignIn.tsx
- app/library/page.tsx
- app/library/loading.tsx
- app/library/error.tsx
- app/sales/SalesClient.tsx
- app/sales/page.tsx
- app/settings/page.tsx (redirect only)
- app/notifications/NotificationsClient.tsx
- app/notifications/page.tsx
- app/download/DownloadClient.tsx
- app/download/page.tsx
- app/redeem/RedeemClient.tsx
- app/redeem/page.tsx
- app/unsubscribe/UnsubscribeClient.tsx
- app/unsubscribe/page.tsx
- app/become-an-artist/BecomeArtistClient.tsx
- app/become-an-artist/page.tsx
- app/admin/AdminStats.tsx
- app/admin/AdminFeatureFlags.tsx
- app/admin/layout.tsx
- app/admin/page.tsx
- app/components/pwa/InstallBanner.tsx
- app/components/pwa/NotificationOptIn.tsx
- app/components/pwa/PwaSplash.tsx
- app/components/pwa/ServiceWorkerRegistration.tsx
- app/components/GenreOnboarding.tsx
- tailwind.config.js
