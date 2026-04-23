# Insound Security Measures — Design Spec

**Date:** 2026-04-23
**Stack:** Next.js 14, Cloudflare Pages, Supabase Auth, Resend

---

## 1. Rate Limiting

### Edge-Level (Cloudflare)

General API rate limit: 100 requests per IP per minute across all `/api/*` routes. Configured as a Cloudflare Rate Limiting Rule in the dashboard. Returns 429 with `Retry-After` header.

### Business-Logic (Supabase RPC)

A single `rate_limits` table replaces the existing `signup_rate_limit` table:

- **Columns:** `id` (uuid), `key` (text — e.g. `magic_link:email@example.com`, `purchase:192.168.x.x`), `action` (enum: `magic_link`, `purchase`, `signup`, `redeem_code`, `social_verify`, `email_change`), `created_at` (timestamptz)
- Rows older than 24 hours cleaned up periodically via scheduled delete or filtered on read.

A single RPC function `check_rate_limit(p_key text, p_action text, p_max int, p_window interval)` counts matching rows within the window and raises an exception if the limit is exceeded.

**Limits:**

| Action | Key | Max | Window |
|--------|-----|-----|--------|
| Magic links | email address | 3 | 1 hour |
| Purchases | IP address | 10 | 1 hour |
| Signups | IP address | 5 | 1 hour |
| Code redemptions | IP address | 10 | 1 hour |
| Social verification | artist user_id | 10 | 1 hour |
| Email change | user_id | 1 | 24 hours |

Each API route handler calls `check_rate_limit` before processing. On limit exceeded, return 429 with `Retry-After` header.

**Migration:** The existing `signup_rate_limit` table and `check_signup_rate` function are replaced. The referral route updates to use `check_rate_limit`.

---

## 2. Session Management

### `user_sessions` Table

- **Columns:** `id` (uuid), `user_id` (references auth.users), `device` (text — parsed from User-Agent, e.g. "Chrome on macOS"), `ip_hash` (text — SHA256 of full IP), `ip_display` (text — masked, e.g. "192.168.x.x"), `city` (text, nullable), `country` (text, nullable), `last_active_at` (timestamptz), `last_verified_at` (timestamptz, nullable — used for fresh auth checks), `created_at` (timestamptz)
- **RLS:** Users can only read/delete their own sessions.

### Session Creation

On auth callback (`/app/auth/callback/route.ts`):

1. Insert a new `user_sessions` row
2. Parse `User-Agent` header for device string
3. Get IP from `x-forwarded-for`, mask first two octets for `ip_display`, SHA256 hash for `ip_hash`
4. Get location from Cloudflare `cf-ipcountry` header (country) and `cf-ipcity` if available
5. Set `session_id` cookie (httpOnly, secure, sameSite strict, 30-day expiry)

### Activity Tracking

In middleware, for authenticated requests:

- Read `session_id` cookie
- Update `last_active_at` via Supabase RPC, throttled to once per 5 minutes (use a `last_tracked` cookie with 5-minute expiry to avoid read-before-write on every request)

### Expiry

Sessions with `last_active_at` older than 30 days are considered expired. Filtered out on read; cleaned up periodically.

### Settings UI (Settings → Security)

New tab in settings navigation alongside Account and Profile:

- Lists all active (non-expired) sessions for the current user
- Each row: device, last active (relative time), masked IP, location (city/country if available), "Sign out" button
- Current session highlighted with "This device" label (matched by `session_id` cookie)
- "Sign out all other sessions" button at the bottom — deletes all session rows except current

Available to all authenticated users (artists and fans).

---

## 3. Email Change & Fresh Auth

### Fresh Auth Gate

Sensitive actions require `last_verified_at` on the current `user_sessions` row to be within the last 15 minutes. Affected actions:

- Email change
- Account deletion
- Stripe Connect changes

If `last_verified_at` is stale or null, the UI shows a re-verify modal: "To continue, verify your identity. We'll send a magic link to [current email]."

**Re-verify flow:**

1. User triggers a sensitive action
2. API returns 403 (stale auth)
3. UI shows modal → user clicks "Send verification"
4. Calls `/api/auth/magic-link` with template `'reverify'`
5. On callback, updates `last_verified_at` on the current session row, redirects back to settings
6. User retries the action

### Email Change

**Route:** `POST /api/account/change-email`

1. Requires authenticated user
2. Checks fresh auth (`last_verified_at` within 15 minutes) — returns 403 if stale
3. Rate limited: 1 per user per 24 hours via `check_rate_limit`
4. Validates email format
5. Calls `supabase.auth.admin.updateUserById(userId, { email: newEmail })`
6. Sends notification to OLD email via Resend: "Your Insound email has been changed to [new email]. If this wasn't you, contact us immediately at [support email]."

**Settings UI (Settings → Account):**

- New "Change email" section with input field and "Update email" button
- On submit, checks fresh auth — if stale, shows re-verify modal
- Success state: "Email updated. A notification was sent to your previous email."

---

## 4. Suspicious Activity Detection

### `suspicious_activity_flags` Table

- **Columns:** `id` (uuid), `user_id` (references auth.users), `flag_type` (enum: `high_chargeback_rate`, `chargeback_volume`, `rapid_transactions`, `failed_payouts`), `details` (jsonb), `reviewed` (boolean, default false), `reviewed_by` (text, nullable — admin email), `reviewed_at` (timestamptz, nullable), `created_at` (timestamptz, default now())
- **RLS:** Only service role can insert. Admins read/update via API.

### `payout_events` Table

- **Columns:** `id` (uuid), `user_id` (references auth.users), `stripe_payout_id` (text), `status` (enum: `paid`, `failed`, `canceled`), `failure_reason` (text, nullable), `created_at` (timestamptz)
- Populated from `payout.paid` and `payout.failed` webhook events.

### Detection Triggers (Stripe Webhook Handler)

All checks are webhook-triggered for immediate flagging:

| Webhook Event | Check | Flag Type | Threshold |
|---------------|-------|-----------|-----------|
| `charge.dispute.created` | Chargeback rate in last 30 days | `high_chargeback_rate` | >2% |
| `charge.dispute.created` | Chargeback count in last 30 days | `chargeback_volume` | >10 |
| `checkout.session.completed` | Transaction count in last hour | `rapid_transactions` | >50 |
| `payout.failed` | Failed payout count | `failed_payouts` | ≥3 failures in 30 days |

**Deduplication:** Before inserting, check if an unreviewed flag of the same type exists for this user. If so, update the `details` JSON rather than creating a duplicate.

### Admin Notification

On flag creation, send email to all `ADMIN_EMAILS` via Resend with: artist name, flag type, details summary, link to admin review page.

### Admin Portal (`/admin/flags`)

- List of all flags, filterable by reviewed/unreviewed
- Each row: artist name, flag type, details summary, created date, reviewed status
- Expand to see full details JSON, "Mark as reviewed" button (records admin email + timestamp)
- No auto-suspension — admin review only

---

## New Database Tables Summary

| Table | Purpose |
|-------|---------|
| `rate_limits` | Generalized rate limiting (replaces `signup_rate_limit`) |
| `user_sessions` | Session tracking with device, IP, location, activity, and fresh auth |
| `suspicious_activity_flags` | Flagged artist accounts for admin review |
| `payout_events` | Stripe payout event history for failed payout detection |

## New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/account/change-email` | POST | Email change with fresh auth + rate limit |
| `/api/auth/magic-link` | POST | Existing — add `'reverify'` template |
| `/api/admin/flags` | GET | List suspicious activity flags |
| `/api/admin/flags/[id]` | PATCH | Mark flag as reviewed |

## Modified Files

| File | Changes |
|------|---------|
| `middleware.ts` | Add session activity tracking (throttled `last_active_at` update) |
| `app/auth/callback/route.ts` | Create `user_sessions` row, set `session_id` cookie, handle `reverify` redirect |
| `supabase/functions/stripe-webhook/index.ts` | Add suspicious activity checks on `charge.dispute.created`, `checkout.session.completed`, `payout.failed`/`payout.paid` |
| `app/settings/` | Add Security tab with sessions list; add email change UI to Account tab |
| `app/settings/account/AccountSettingsClient.tsx` | Add fresh auth gate to account deletion |
| `app/api/referral/route.ts` | Switch from `check_signup_rate` to `check_rate_limit` |
| `app/admin/page.tsx` | Add link to flags review page |
