# Insound Launch Checklist

Two lists: a **pre-deploy smoke test** (run before every push) and **launch requirements** (must all be true before going live).

---

## Pre-Deploy Smoke Test

Run through this in 5-10 minutes before every push. If anything fails, do not deploy.

### Audio Playback
- [ ] Click play on a release page — 30-second preview plays
- [ ] Track advances to next song automatically
- [ ] Pause, resume, skip forward, skip back all work
- [ ] Player bar shows correct track title and artist
- [ ] Volume slider works
- [ ] Player persists across page navigation

### Auth
- [ ] Sign up with email (new account)
- [ ] Sign in with email (existing account)
- [ ] Sign in with Google OAuth
- [ ] Sign out — redirects correctly, player state clears
- [ ] Protected pages (/dashboard, /library, /settings) redirect to auth when logged out

### Browse & Search
- [ ] Home page loads with featured releases
- [ ] Search returns artists and releases
- [ ] Clicking a search result navigates to the correct page
- [ ] Artist page loads with releases listed
- [ ] Release page loads with tracks, price, and cover art

### Purchase Flow (use Stripe test mode)
- [ ] "Buy" button opens checkout on a release page
- [ ] PWYW slider works (amount updates, minimum enforced)
- [ ] Complete checkout with test card (4242 4242 4242 4242)
- [ ] Download page appears after payment
- [ ] Downloaded file is a valid audio file

### Basket
- [ ] Add item to basket — badge count updates
- [ ] Open basket drawer — items listed with correct prices
- [ ] Remove item from basket
- [ ] Basket checkout completes (test card)
- [ ] Basket clears after successful checkout

### Fan Library
- [ ] /library shows purchased releases
- [ ] Can re-download a purchased release
- [ ] Save/favourite button toggles correctly
- [ ] Saved items appear in the saved tab

### Artist Dashboard (log in as test artist)
- [ ] Dashboard loads without errors
- [ ] Can create a new draft release
- [ ] Can add tracks to a release
- [ ] Can upload cover art
- [ ] Can publish a release (shows on artist page)
- [ ] Can edit an existing release's price

### Currency
- [ ] Prices display in correct currency (based on locale or selection)
- [ ] Currency switching updates all visible prices

---

## Launch Requirements

Every item must be verified true before going live. Check the box and note the date.

### Stripe
- [ ] Stripe is in **live mode** (not test mode)
- [ ] Webhook endpoint points to production URL
- [ ] All webhook events are registered (checkout.session.completed, charge.refunded, charge.dispute.created)
- [ ] Platform fee percentage is correct
- [ ] PWYW minimum enforced server-side (not just client)

### Auth & Security
- [ ] Google OAuth redirect URIs include both `getinsound.com` and `www.getinsound.com`
- [ ] CSRF origin check includes production domain
- [ ] `.env.local` is in `.gitignore` (verify: `git ls-files .env.local` returns nothing)
- [ ] `UNSUBSCRIBE_SECRET` is set as a dedicated env var (not falling back to service role key)
- [ ] Rate limiting migration applied to production database
- [ ] No test/dev API keys in production environment

### Data & Database
- [ ] All Supabase migrations applied to production
- [ ] RLS policies active on all public-facing tables
- [ ] No direct browser-to-Supabase writes for sensitive operations (releases, artist profiles)

### Domain & Infrastructure
- [ ] DNS resolves correctly for apex and www
- [ ] HTTPS working on all routes
- [ ] Cloudflare caching rules configured
- [ ] Error pages (404, 500) render correctly

### Content & Legal
- [ ] Privacy policy page exists and is linked
- [ ] Terms of service page exists and is linked
- [ ] Cookie consent banner works (if required)
- [ ] Fan account deletion path exists (GDPR)

### Email
- [ ] Transactional emails send from correct domain (not localhost)
- [ ] Unsubscribe links work
- [ ] Purchase confirmation email includes download link

### Prices & Money
- [ ] All release prices are in correct currency (pence, not pounds)
- [ ] No releases priced at 0 that shouldn't be free
- [ ] Artist payout flow works end-to-end (Stripe Connect)
- [ ] Platform fee calculated correctly on test purchase

---

## Known Regression Hot Spots

These are the areas that have broken before. Pay extra attention after changes nearby.

| Area | What breaks | What to check | Root cause |
|------|------------|---------------|------------|
| **Track preview** | 30s preview stops working | Play any track on a release page | Stream API auth check, player store hydration, or signed URL generation |
| **PlayerBar** | Accent color wrong, playback state stale | Play track, navigate, play another | Zustand store + IndexedDB hydration race |
| **Checkout modal** | Modal doesn't close, or re-open fails | Buy → complete → close → buy again | Stripe embedded checkout refs not cleaned up |
| **Basket prices** | Wrong amount charged or displayed | Add PWYW item, change currency | CurrencyProvider cache + basket store price sync |
| **Favourites** | Save button doesn't persist | Save a release, refresh page | Optimistic update rolls back silently on API failure |
| **Dashboard** | Release edits lost or state mismatch | Edit price, navigate away, come back | 116KB monolith; local state vs server state divergence |
| **Auth redirect** | Loops or lands on wrong page | Sign in with ?next= parameter | Complex redirect logic in AuthClient |
| **Download** | "Still finalising" timeout | Complete checkout on slow connection | 12s polling timeout in ReleaseClient |

---

## How to Use This

1. **Before every deploy**: Run the smoke test. All boxes must pass.
2. **Before launch**: Complete all launch requirements. Get a second pair of eyes.
3. **After any fix in a hot spot area**: Re-test that specific hot spot AND its neighbours in the table above.
4. **When something breaks twice**: It needs an automated test. Add it to the project's test suite so CI catches it next time.
