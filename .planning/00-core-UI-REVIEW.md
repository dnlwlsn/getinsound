# Core Pages -- UI Review

**Audited:** 2026-04-28
**Baseline:** Abstract 6-pillar standards (no UI-SPEC exists)
**Screenshots:** Captured (7 screenshots: desktop + mobile for homepage, desktop for explore, for-artists, for-fans, why-us, signup)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Strong brand voice throughout; error messages default to generic "Something went wrong" |
| 2. Visuals | 4/4 | Clear focal points, consistent visual hierarchy, good hover states and transitions |
| 3. Color | 3/4 | Disciplined use of orange-600 accent; 184 hardcoded hex/rgb values mostly in landing pages |
| 4. Typography | 3/4 | Consistent Montserrat usage; font-black heavily used (5 weight variants in play) |
| 5. Spacing | 3/4 | Consistent Tailwind scale; some arbitrary bracket values in settings pages |
| 6. Experience Design | 4/4 | Loading, error, and empty states well-covered across all major flows |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **Generic error copy across 10+ components** -- Users see "Something went wrong. Please try again." with no guidance on what failed or what to do next -- Replace with context-specific messages: "We couldn't send your magic link -- check your connection and try again" (AuthClient.tsx:63), "We couldn't load your collection -- pull to refresh" (LibraryClient.tsx:184)

2. **Hardcoded color values in landing pages (for-artists, for-fans, for-press, why-us, cookie banner)** -- Maintenance risk and potential drift from brand tokens -- Extract recurring values (#F56D00, #09090b, rgba(5,5,5,0.75)) into Tailwind config or CSS custom properties. CookieBanner.tsx uses `bg-[#F56D00]` and `text-[#09090b]` instead of `bg-orange-600` and `text-insound-bg`

3. **Signed-out homepage hero skipped when only 1-2 releases exist** -- The FeaturedHero component returns null if fewer than 3 releases, leaving a sparse page with just the sign-up banner and a single card -- Add a simpler hero variant for low-release counts (1-2 releases), or show the existing release grid at larger card sizes

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Strengths:**
- CTAs are specific and action-oriented: "Sign up free", "Start selling your music", "Explore music", "Continue with email"
- Empty states are well-worded: "No releases in this genre yet" (HomeClient.tsx:280), "No new releases this week" (DiscoverClient.tsx:574), "Your basket is empty" (BasketDrawer.tsx:239)
- FAQ copy is thorough and conversational -- reads like a real person wrote it
- For-artists page has excellent comparison copy with specific numbers

**Issues:**
- `global-error.tsx:11` -- "Something went wrong." with "Try Again" button. No context about what happened
- `AuthClient.tsx:63` -- "Something went wrong. Please try again." (magic link failure)
- `SignupClient.tsx:50` -- Same generic error
- `LibraryClient.tsx:184,799,958,989` -- Four separate instances of "Something went wrong" variants
- The "Back" link on landing page navs (for-artists, for-fans, for-press, faq, privacy, ai-policy) uses a left arrow character which is inconsistent with the rest of the UI

### Pillar 2: Visuals (4/4)

**Strengths:**
- Homepage has clear visual hierarchy: hero banner > featured releases > genre filter > grid
- Explore page has well-structured featured hero with large + small card layout
- Album art hover states are polished: scale-105 zoom + play button overlay + backdrop blur
- Mobile bottom nav has clear icon + label pairing with active state coloring
- Signup/auth pages have subtle radial gradient glow and grid background for depth
- BasketDrawer has proper focus trap, escape-to-close, click-outside-to-close
- NotificationDropdown uses full-width positioning on mobile, dropdown on desktop
- All icon-only buttons have aria-labels: "Menu", "Profile menu", "Clear search", "Basket (N items)", "Notifications (N unread)"
- Discover page "Insound Selects" section has excellent editorial layout with blurred background

**Minor notes:**
- NavBar component (NavBar.tsx) appears unused -- AppNav.tsx is the actual navigation. Dead code

### Pillar 3: Color (3/4)

**Strengths:**
- Orange-600 (#F56D00) is used consistently as the primary accent on CTAs, badges, active states, and price tags
- Dark background (bg-zinc-950 / bg-[#09090b]) is consistent across all pages
- 60/30/10 split is well-maintained: ~60% dark bg, ~30% zinc-400/500/600 text, ~10% orange accent
- Red used only for destructive actions (sign out hover, error states)
- Active nav items use text-orange-500, inactive use text-zinc-500 -- clear distinction

**Issues:**
- 184 instances of hardcoded hex/rgb values across the codebase. Most are in landing pages and global-error.tsx
- CookieBanner.tsx:77,92,111 uses `bg-[#F56D00]` and `text-[#09090b]` instead of token classes
- global-error.tsx uses inline `style` with `color: '#F56D00'` because it cannot use Tailwind (understandable for global error)
- ForArtistsClient.tsx, ForFansClient.tsx, ForPressClient.tsx navs use inline `style` for backdrop-blur backgrounds -- could use a shared utility class

### Pillar 4: Typography (3/4)

**Strengths:**
- Single font family (Montserrat) used for both sans and display -- clean and consistent
- Font weights loaded are 400, 600, 700 -- but font-black (900) is heavily used via Tailwind class, which may cause flash of unstyled text or weight substitution since 900 is not explicitly loaded in the font config
- Section headings follow a consistent pattern: `text-[10px] font-black uppercase tracking-widest` for labels, `text-4xl md:text-5xl font-bold` for section titles
- Body text consistently uses `text-sm` and `text-[15px]` for prose content

**Issues:**
- 5 distinct font weights in active use: font-normal, font-medium, font-semibold, font-bold, font-black. The spec only loads weights 400, 600, 700 (layout.tsx:16-18). font-black (900) is the most common weight class but is NOT loaded -- this means the browser is synthesizing bold, which can look poor on some systems
- `text-[10px]`, `text-[9px]`, `text-[8px]`, `text-[11px]`, `text-[13px]`, `text-[15px]` -- 6 arbitrary font sizes used alongside standard Tailwind sizes. While some are intentional for micro-labels, this is a wide range
- WhyUsClient.tsx:110 uses `text-8xl` which is the largest size in the codebase -- appropriate for the hero but worth noting

### Pillar 5: Spacing (3/4)

**Strengths:**
- Consistent max-width containers: `max-w-7xl` for app pages, `max-w-4xl` for landing pages, `max-w-2xl` for legal/prose pages
- Consistent horizontal padding: `px-5 md:px-10` for app pages, `px-6` for landing pages
- Section spacing follows a pattern: `py-24` for major sections, `py-10`/`py-12` for subsections
- Genre pill buttons use consistent `px-4 py-2 rounded-full` sizing

**Issues:**
- Some arbitrary bracket spacing values exist (`text-[10px]`, `text-[9px]`) but these are in font sizing not spacing
- Privacy/terms pages use `pt-36 pb-24` while FAQ uses the same -- consistent within legal pages
- The AppNav signed-out state uses `max-w-6xl` while signed-in uses `max-w-7xl` -- slight inconsistency in nav width between states

### Pillar 6: Experience Design (4/4)

**Strengths:**
- **Loading states:** ExploreClient has shimmer skeleton loader (ExploreClient.tsx:310-319), SearchClient shows "Searching..." text, NotificationDropdown has spinner
- **Error states:** global-error.tsx covers unrecoverable errors, per-route error.tsx files exist for explore, library, release, dashboard
- **Empty states:** Well-handled across all list views -- HomeClient (no genre releases), ExploreClient (no releases at all vs no filtered results), DiscoverClient (no featured artist, no new releases), SearchClient (no results, no search yet), BasketDrawer (empty basket)
- **Auth flow:** signup redirects logged-in users, auth redirects logged-in users, welcome redirects seen-welcome users
- **Accessibility:** Skip-to-content link in layout.tsx:57, aria-labels on all icon buttons, role="dialog" on BasketDrawer, focus trap in BasketDrawer, Escape key handling on multiple dropdowns
- **Cookie consent:** Three-tier system (accept all, functional, essential-only) with animated mount/unmount
- **Mobile responsive:** Bottom nav for signed-in mobile users, full-width notification dropdown on mobile, search redirects to /search page on mobile (AppNav.tsx:143)
- **PWA support:** Service worker registration, install banner, splash screen

**Minor notes:**
- SearchClient.tsx wraps in Suspense boundary (search/page.tsx:12) -- correctly handles useSearchParams CSR requirement
- WhyUsClient sticky register bar has proper dismiss + session persistence

---

## Files Audited

- `app/page.tsx` -- Homepage server component
- `app/layout.tsx` -- Root layout with nav, player, PWA, cookie banner
- `app/not-found.tsx` -- 404 page
- `app/global-error.tsx` -- Global error boundary
- `app/components/HomeClient.tsx` -- Homepage client component
- `app/components/ui/NavBar.tsx` -- Unused nav component
- `app/components/ui/AppNav.tsx` -- Main navigation (signed-in + signed-out)
- `app/components/ui/SearchInput.tsx` -- Inline search with dropdown
- `app/components/ui/ProfileMenu.tsx` -- User profile dropdown
- `app/components/ui/CookieBanner.tsx` -- GDPR cookie consent
- `app/components/ui/BasketButton.tsx` -- Shopping basket trigger
- `app/components/ui/BasketDrawer.tsx` -- Full basket/checkout drawer
- `app/components/ui/NotificationBell.tsx` -- Notification bell with count
- `app/components/ui/NotificationDropdown.tsx` -- Notification list dropdown
- `app/explore/ExploreClient.tsx` -- Explore page with filters, grid/list views
- `app/explore/page.tsx` -- Explore server component
- `app/discover/DiscoverClient.tsx` -- For You page with featured artist, releases, recommendations
- `app/discover/page.tsx` -- Discover server component
- `app/search/SearchClient.tsx` -- Full search results page
- `app/search/page.tsx` -- Search page with Suspense
- `app/for-artists/ForArtistsClient.tsx` -- Artist landing page
- `app/for-artists/page.tsx`
- `app/for-fans/ForFansClient.tsx` -- Fan landing page
- `app/for-fans/page.tsx`
- `app/for-press/ForPressClient.tsx` -- Press landing page
- `app/for-press/page.tsx`
- `app/why-us/WhyUsClient.tsx` -- Why Insound calculator page
- `app/why-us/page.tsx`
- `app/faq/page.tsx` -- FAQ page
- `app/signup/SignupClient.tsx` -- Signup flow
- `app/signup/page.tsx`
- `app/auth/AuthClient.tsx` -- Sign-in page (magic link + password)
- `app/auth/page.tsx`
- `app/welcome/WelcomeClient.tsx` -- Post-auth welcome screen
- `app/welcome/page.tsx`
- `app/terms/page.tsx` -- Terms of Service
- `app/privacy/page.tsx` -- Privacy Policy
- `app/ai-policy/page.tsx` -- AI Content Policy
- `tailwind.config.js` -- Tailwind configuration
