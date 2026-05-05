# Insound Launch Checklist

Run through these flows with Stripe test mode before going live. Each section takes 2-3 minutes.

---

## 1. Fan: Browse and discover
- [ ] Visit `/explore` — releases load, genre filters work
- [ ] GenreOnboarding appears for new users with no preferences
- [ ] Visit a release page — cover, tracklist, price, artist name display correctly
- [ ] Play a preview — audio streams, player bar appears
- [ ] Recommendations section shows related releases (tag-based or genre fallback)
- [ ] Footer visible with Privacy + Terms links

## 2. Fan: Purchase a release
- [ ] Click Buy on a paid release — consent stage appears (right-to-cancel waiver)
- [ ] Confirm consent — Stripe embedded checkout loads
- [ ] Complete payment (test card `4242 4242 4242 4242`) — polling resolves, success shown
- [ ] Check email — branded receipt arrives with unsubscribe link and price
- [ ] Release appears in `/library`

## 3. Fan: Purchase as guest (no account)
- [ ] Buy a release without being signed in
- [ ] After payment, see "Check your email" (not a dead /library link)
- [ ] Email arrives with magic link — clicking it creates account and grants access

## 4. Fan: Download purchased music
- [ ] In library, click download on a single track — file downloads
- [ ] For an album, per-track buttons appear — each downloads individually
- [ ] "Download All" triggers sequential downloads without crashing

## 5. Fan: PWYW (pay what you want)
- [ ] On a PWYW release, enter a custom amount above minimum — checkout uses that amount
- [ ] Try entering below minimum — error shown
- [ ] Complete purchase — receipt shows the custom amount

## 6. Fan: Signup and auth
- [ ] Sign up with email — magic link arrives (branded, no password needed)
- [ ] Click link — account created, redirected correctly
- [ ] Sign in with Google OAuth
- [ ] Sign out — redirects correctly, player state clears
- [ ] Protected pages redirect to auth when logged out

## 7. Artist: Signup and onboarding
- [ ] Register as artist — slug created, dashboard accessible
- [ ] Reserved slugs rejected (e.g. "admin", "settings")
- [ ] Connect Stripe — onboarding flow completes

## 8. Artist: Publish a release
- [ ] Create release — fill title, upload cover, upload tracks
- [ ] If upload fails mid-way — release row is cleaned up, can retry without slug conflict
- [ ] Set price, add tags, publish — release appears on `/explore`
- [ ] Preview stream works for non-owners

## 9. Artist: Get paid
- [ ] After a fan purchases, check Stripe dashboard — Transfer created to connected account
- [ ] Platform fee deducted correctly (founding artist rate vs standard)
- [ ] Artist sees the sale in `/sales`
- [ ] If artist has no Stripe account — clear error shown to buyer, not silent skip

## 10. Merch: Full flow
- [ ] List a merch item with variants and postage
- [ ] Fan purchases — order appears in artist dashboard
- [ ] Artist dispatches — fan gets notification
- [ ] Fan requests return — artist confirms — refund issued (or logged as refund_failed)

## 11. Pre-orders
- [ ] Publish a pre-order release — fans can buy but not stream/download
- [ ] Cancel pre-order — only fans with successful refunds get the email
- [ ] Release a pre-order — fans gain streaming/download access

## 12. Basket checkout
- [ ] Add multiple items from different artists — badge count updates
- [ ] Open basket drawer — items listed with correct prices
- [ ] Remove item from basket
- [ ] "Back to basket" button works after Stripe mounts
- [ ] Basket checkout completes — all artists receive transfers
- [ ] Basket clears after successful checkout

## 13. Account and settings
- [ ] Fan edits profile — avatar validates magic bytes (try .txt renamed to .jpg — rejected)
- [ ] Verification banner appears for unverified users, dismiss works, hidden on auth routes
- [ ] Settings nav shows Profile and Account only (no Security tab)
- [ ] Shared browser: log out + log in as different user — play history is separate

## 14. Rate limiting and security
- [ ] Hit stream endpoint rapidly for same track — 429 after 10 requests
- [ ] Hit general endpoints rapidly — 429 after threshold
- [ ] Try reserved artist slugs — rejected

## 15. Mobile
- [ ] Player bar, install banner, and any other bottom elements don't overlap
- [ ] Expanded player scrolls on small screens (doesn't overflow)
- [ ] Artist mobile nav highlights correct active page
- [ ] Sticky buy bar hides when player is expanded

## 16. Emails
- [ ] All post-purchase emails include unsubscribe footer
- [ ] Unsubscribe link works (marks user as unsubscribed)
- [ ] Magic link emails are branded (not Supabase default)

## 17. Currency
- [ ] Prices display in correct currency based on locale
- [ ] Currency switching updates all visible prices

---

## Go-Live Steps (after all green above)

1. Switch Stripe to live mode (update env vars)
2. Verify Google OAuth redirect URIs include both `getinsound.com` and `www.getinsound.com`
3. Verify all Supabase migrations applied (including `recommend_by_tags`)
4. Publish at least one release so Explore isn't empty
5. Test one real purchase end-to-end with a real card
6. Ship it

---

## Known Regression Hot Spots

Areas that have broken before. Pay extra attention after changes nearby.

| Area | What breaks | What to check |
|------|------------|---------------|
| Track preview | Preview stops working | Play any track on a release page |
| PlayerBar | Accent color wrong, playback state stale | Play track, navigate, play another |
| Checkout | Modal doesn't close, or re-open fails | Buy → complete → close → buy again |
| Basket prices | Wrong amount charged or displayed | Add PWYW item, change currency |
| Auth redirect | Loops or lands on wrong page | Sign in with ?next= parameter |
| Download | "Still finalising" timeout | Complete checkout on slow connection |
| Transfers | Artist not paid | Check Stripe for Transfer after purchase |
