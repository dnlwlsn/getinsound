# Account Deletion — Design Spec

GDPR-compliant account deletion for both fan and artist accounts, with 24-hour cooldown, purchase anonymisation, and scheduled cleanup.

## User Flows

### Fan Deletion

**Route:** `/settings/account`

1. Fan clicks "Delete my account" in danger zone section
2. Confirmation modal shows:
   - Warning text explaining permanent deletion of account, library, profile, and data
   - "Download all my music" button — generates individual download grants (48hr expiry) for all purchased releases and displays links
   - Text input requiring "DELETE" to enable confirm button
   - Cancel / Delete buttons
   - Note about 24-hour cooldown
3. On confirm:
   - Creates `account_deletion_requests` row with `execute_at = now() + 24hrs`
   - Sends "deletion scheduled" email via Resend with cancel URL and reminder to download music before deletion
   - Page shows pending deletion banner with scheduled time and cancel button
4. At hour 23: scheduled job sends "last chance" email with cancel link
5. At hour 24: scheduled job executes deletion (see Deletion Execution below)
6. Cancel: user clicks cancel on banner or email link → sets `cancelled = true`

### Artist Deletion

**Route:** `/dashboard/settings` (Account tab)

1. Artist clicks "Delete my account" in danger zone section
2. Impact assessment modal shows:
   - Stats panel: release count, total sales, active pre-order count
   - Bullet list of consequences:
     - All releases removed from platform
     - Existing purchasers get 90 days to download
     - Active pre-orders cancelled and refunded
     - Artist profile removed permanently
     - Fan account and library removed
   - Stripe settlement note (account stays until payouts settle)
   - "Download all my purchased music" button (for their fan library)
   - DELETE text input and confirm/cancel buttons
3. Same 24-hour cooldown and cancellation flow as fan
4. On execution: artist-specific steps plus full fan deletion (see below)

## Database Schema

### New table: `account_deletion_requests`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, default gen_random_uuid() |
| `user_id` | uuid | FK auth.users, cascade delete |
| `user_type` | text | `'fan'` or `'artist'` |
| `requested_at` | timestamptz | default now() |
| `execute_at` | timestamptz | requested_at + interval '24 hours' |
| `last_chance_sent` | boolean | default false |
| `cancelled` | boolean | default false |
| `executed` | boolean | default false |
| `executed_at` | timestamptz | nullable |
| `stripe_pending_disconnect` | boolean | default false — artist only, set when Stripe balance non-zero |

**Constraints:**
- Partial unique index on `user_id` where `cancelled = false AND executed = false` (prevents duplicate pending requests)
- RLS: users can SELECT/INSERT/UPDATE their own rows only. Edge functions use service role.

### Schema changes to `releases`

- Add `'deleted'` to visibility check constraint (becomes: `public`, `unlisted`, `private`, `deleted`)
- Add column `deletion_retain_until` (timestamptz, nullable) — set to `now() + 90 days` on artist deletion

### No changes to `purchases`

Anonymisation is done via UPDATE: set `buyer_user_id = null`, `buyer_email = 'deleted@anonymised'`.

## Deletion Execution

### Fan deletion steps (in order)

1. Generate download grants for all purchases (48hr expiry, 10 max uses)
2. Anonymise purchases: `SET buyer_user_id = null, buyer_email = 'deleted@anonymised'` where `buyer_user_id = user_id`
3. Delete `fan_profiles` row (cascades to: `fan_preferences`, `fan_pinned_releases`, `fan_badges`, `fan_hidden_purchases`)
4. Delete `fan_follows` where `fan_id = user_id`
5. Delete avatar from Supabase Storage `avatars/{user_id}/`
6. Delete auth user via `supabase.auth.admin.deleteUser(user_id)`
7. Send "deletion complete" email with download links via Resend
8. Mark request: `executed = true`, `executed_at = now()`

### Artist deletion steps (before fan steps)

1. Cancel active pre-orders:
   - Find purchases where `artist_id = user_id AND pre_order = true AND status = 'paid'` on unreleased releases
   - Refund each via Stripe API
   - Update purchase status to `'refunded'`
   - Send refund notification email to each affected fan
2. Mark all releases: `visibility = 'deleted'`, `deletion_retain_until = now() + interval '90 days'`
3. Anonymise artist sales records: on purchases where `artist_id = user_id`, set `buyer_email = 'deleted@anonymised'` and `buyer_user_id = null`. Keep `amount_pence`, `artist_pence`, `platform_pence`, `stripe_fee_pence`, `stripe_pi_id`, `paid_at` intact for accounting.
4. Delete artist posts and post-media from Storage `post-media/{user_id}/`
5. Check Stripe connected account balance and pending payouts:
   - If zero balance and no pending: revoke OAuth connection via Stripe API
   - If non-zero: set `stripe_pending_disconnect = true` on deletion request (daily job retries)
6. Delete `artist_accounts` and `artists` rows
7. Proceed to fan deletion steps above

## Scheduled Jobs (pg_cron)

| Job | Schedule | Edge Function | Logic |
|-----|----------|---------------|-------|
| Last chance emails | Every minute | `send-last-chance-email` | WHERE `execute_at - now() <= interval '1 hour' AND last_chance_sent = false AND cancelled = false AND executed = false` |
| Process deletions | Every minute | `process-account-deletion` | WHERE `execute_at <= now() AND cancelled = false AND executed = false` |
| Content cleanup | Daily 03:00 UTC | `cleanup-deleted-content` | Releases WHERE `visibility = 'deleted' AND deletion_retain_until <= now()` — delete from masters, covers, previews Storage, then delete release/track rows |
| Stripe disconnect retry | Daily 04:00 UTC | `retry-stripe-disconnect` | Requests WHERE `stripe_pending_disconnect = true AND executed = true` — check balance, disconnect if settled |

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/account/delete` | GET | Returns impact data for artist (release count, sales, pre-orders). Returns pending request status for any user. |
| `/api/account/delete` | POST | Creates deletion request. Validates no pending request exists. Sends confirmation email. |
| `/api/account/delete` | DELETE | Cancels pending request (sets `cancelled = true`). |
| `/api/account/delete/download-links` | GET | Generates download grants for all user purchases, returns array of `{ release_title, links[] }`. |

## Client Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `SettingsTabs` | `components/settings/SettingsTabs.tsx` | Shared tab navigation (Profile / Account) |
| `DeleteAccountModal` | `components/settings/DeleteAccountModal.tsx` | Shared modal — props: `userType`, `impactData?`. Handles DELETE input, download trigger, confirmation. |
| `DeletionPendingBanner` | `components/settings/DeletionPendingBanner.tsx` | Orange banner with scheduled time and cancel button |
| `AccountSettingsClient` | `app/settings/account/AccountSettingsClient.tsx` | Fan account page — danger zone + modal + pending state |
| `DashboardSettingsClient` | `app/dashboard/settings/DashboardSettingsClient.tsx` | Artist account page — Stripe status + danger zone + modal + pending state |

## Pages

| Route | Server Component | Client Component |
|-------|-----------------|-----------------|
| `/settings/account` | Loads user profile, pending deletion request | `AccountSettingsClient` |
| `/dashboard/settings` | Loads artist data, impact stats, pending request | `DashboardSettingsClient` |

Existing `/settings/profile` page gets `SettingsTabs` added for navigation.

## Email Templates

| Email | Trigger | Key Content |
|-------|---------|-------------|
| Deletion scheduled | User confirms deletion | Scheduled time, cancel URL, reminder to download music before deletion |
| Last chance | 1 hour before execution | "Deleted in 1 hour" warning, cancel URL |
| Deletion complete | After execution | Confirmation, download links (active 48hrs) |
| Pre-order refund | Artist deletion processing | Release name, refund confirmation, 5-10 business days |

All emails: dark theme (#0A0A0A), HTML, sent via Resend API. Same sender and style as existing emails in `stripe-webhook`.

## Edge Functions (new)

| Function | Triggered By | Purpose |
|----------|-------------|---------|
| `send-last-chance-email` | pg_cron (every minute) | Sends hour-23 warning email, sets `last_chance_sent = true` |
| `process-account-deletion` | pg_cron (every minute) | Executes full fan or artist deletion flow |
| `cleanup-deleted-content` | pg_cron (daily 03:00) | Removes expired artist files from Storage, deletes release/track rows |
| `retry-stripe-disconnect` | pg_cron (daily 04:00) | Retries Stripe OAuth revocation for settled accounts |

## Security

- **RLS on `account_deletion_requests`:** Users can only read/create/cancel their own. Execution via service role.
- **Partial unique index:** Prevents multiple pending requests per user (`WHERE cancelled = false AND executed = false`).
- **Race condition guard:** Edge function re-checks `cancelled` before each destructive step.
- **Auth during cooldown:** User can still log in and use the platform. Pending banner is informational.
- **Stripe settlement:** OAuth revocation deferred until balance is zero. Daily retry job handles this.
- **Referral chain:** `referred_by` strings on other users become stale but are inert. `referral_count` is independent.
- **Progressive purchases:** Purchases with `buyer_user_id = null` (pre-account) are untouched.

## Privacy Policy Update

Document the anonymisation approach:
- Purchases are anonymised (user_id nulled, email replaced) rather than hard-deleted
- Artist sales records retain financial amounts for accounting but PII is removed
- This preserves aggregate analytics for artists while removing all personal data
- Existing purchasers of deleted artist content retain 90-day download access per ToS

## Migration

Single migration file: `supabase/migrations/0017_account_deletion.sql`
- Creates `account_deletion_requests` table
- Adds partial unique index
- Adds RLS policies
- Alters `releases` visibility constraint to include `'deleted'`
- Adds `deletion_retain_until` column to `releases`
- Sets up pg_cron jobs (last-chance emails, process deletions, content cleanup, Stripe retry)
