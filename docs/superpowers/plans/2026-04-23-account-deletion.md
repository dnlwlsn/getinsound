# Account Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GDPR-compliant account deletion for fan and artist accounts with 24-hour cooldown, purchase anonymisation, and scheduled cleanup.

**Architecture:** A new `account_deletion_requests` table tracks pending deletions. API routes handle request/cancel/status. pg_cron triggers Supabase edge functions for: last-chance emails (hour 23), deletion execution (hour 24), artist content cleanup (90 days), and Stripe disconnect retry. Fan UI lives at `/settings/account`, artist UI at `/dashboard/settings`.

**Tech Stack:** Next.js 14 App Router, Supabase (Auth, Postgres, Storage, Edge Functions, pg_cron), Stripe Connect API, Resend email API

---

## File Structure

### New files

| File | Purpose |
|------|---------|
| `supabase/migrations/0017_account_deletion.sql` | New table, schema changes, RLS, pg_cron jobs |
| `app/api/account/delete/route.ts` | GET (status/impact), POST (create request), DELETE (cancel) |
| `app/api/account/delete/download-links/route.ts` | GET �� generate download grants for all purchases |
| `app/settings/account/page.tsx` | Fan account settings server component |
| `app/settings/account/AccountSettingsClient.tsx` | Fan account settings client component |
| `app/dashboard/settings/page.tsx` | Artist dashboard settings server component |
| `app/dashboard/settings/DashboardSettingsClient.tsx` | Artist dashboard settings client component |
| `components/settings/SettingsTabs.tsx` | Shared Profile/Account tab navigation |
| `components/settings/DeleteAccountModal.tsx` | Shared deletion confirmation modal |
| `components/settings/DeletionPendingBanner.tsx` | Orange pending-deletion banner |
| `supabase/functions/send-last-chance-email/index.ts` | Edge function: hour-23 warning email |
| `supabase/functions/process-account-deletion/index.ts` | Edge function: execute fan/artist deletion |
| `supabase/functions/cleanup-deleted-content/index.ts` | Edge function: remove expired artist files |
| `supabase/functions/retry-stripe-disconnect/index.ts` | Edge function: retry Stripe OAuth revocation |

### Modified files

| File | Change |
|------|--------|
| `app/settings/profile/ProfileSettingsClient.tsx` | Add `SettingsTabs` component at top |
| `middleware.ts` | Add `/settings` to auth-protected routes (already protected via fallthrough) |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/0017_account_deletion.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 0017_account_deletion.sql
-- GDPR account deletion: request table, release schema changes, pg_cron jobs.

-- ============================================================
-- 1. ACCOUNT DELETION REQUESTS TABLE
-- ============================================================

create table public.account_deletion_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_type text not null check (user_type in ('fan', 'artist')),
  requested_at timestamptz not null default now(),
  execute_at timestamptz not null default (now() + interval '24 hours'),
  last_chance_sent boolean not null default false,
  cancelled boolean not null default false,
  executed boolean not null default false,
  executed_at timestamptz,
  stripe_pending_disconnect boolean not null default false
);

-- Only one active (non-cancelled, non-executed) request per user
create unique index account_deletion_requests_active_unique
  on public.account_deletion_requests (user_id)
  where cancelled = false and executed = false;

alter table public.account_deletion_requests enable row level security;

-- Users can read their own requests
create policy "Users can read own deletion requests"
  on public.account_deletion_requests
  for select using (auth.uid() = user_id);

-- Users can create their own requests
create policy "Users can create own deletion requests"
  on public.account_deletion_requests
  for insert with check (auth.uid() = user_id);

-- Users can cancel their own requests (update cancelled only)
create policy "Users can cancel own deletion requests"
  on public.account_deletion_requests
  for update using (auth.uid() = user_id);

-- ============================================================
-- 2. RELEASES: add 'deleted' visibility + retention column
-- ============================================================

-- Drop existing check constraint and add new one with 'deleted'
alter table public.releases
  drop constraint if exists releases_visibility_check;

alter table public.releases
  add constraint releases_visibility_check
  check (visibility in ('public', 'unlisted', 'private', 'deleted'));

alter table public.releases
  add column if not exists deletion_retain_until timestamptz;

-- ============================================================
-- 3. PG_CRON JOBS
-- ============================================================

-- Enable pg_cron and pg_net if not already
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Job 1: Send last-chance emails (every minute)
-- Finds requests within 1 hour of execution that haven't been notified
select cron.schedule(
  'account-deletion-last-chance',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-last-chance-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  )
  where exists (
    select 1 from public.account_deletion_requests
    where cancelled = false
      and executed = false
      and last_chance_sent = false
      and execute_at - now() <= interval '1 hour'
      and execute_at > now()
  );
  $$
);

-- Job 2: Process pending deletions (every minute)
select cron.schedule(
  'account-deletion-process',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/process-account-deletion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  )
  where exists (
    select 1 from public.account_deletion_requests
    where cancelled = false
      and executed = false
      and execute_at <= now()
  );
  $$
);

-- Job 3: Cleanup deleted artist content (daily 3am UTC)
select cron.schedule(
  'account-deletion-content-cleanup',
  '0 3 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/cleanup-deleted-content',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  )
  where exists (
    select 1 from public.releases
    where visibility = 'deleted'
      and deletion_retain_until <= now()
  );
  $$
);

-- Job 4: Retry Stripe disconnections (daily 4am UTC)
select cron.schedule(
  'account-deletion-stripe-retry',
  '0 4 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/retry-stripe-disconnect',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  )
  where exists (
    select 1 from public.account_deletion_requests
    where stripe_pending_disconnect = true
      and executed = true
  );
  $$
);
```

- [ ] **Step 2: Verify migration syntax**

Run: `cd /Users/Dan/projects/getinsound && npx supabase db lint --level warning`

If the linter isn't set up, just verify the file looks correct.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0017_account_deletion.sql
git commit -m "feat: account deletion migration — table, RLS, pg_cron jobs"
```

---

### Task 2: Shared UI Components

**Files:**
- Create: `components/settings/SettingsTabs.tsx`
- Create: `components/settings/DeleteAccountModal.tsx`
- Create: `components/settings/DeletionPendingBanner.tsx`

- [ ] **Step 1: Create SettingsTabs component**

```tsx
// components/settings/SettingsTabs.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Profile', href: '/settings/profile' },
  { label: 'Account', href: '/settings/account' },
]

export function SettingsTabs() {
  const pathname = usePathname()

  return (
    <div className="flex gap-6 border-b border-zinc-800 mb-8">
      {TABS.map(tab => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`pb-3 text-sm font-bold transition-colors ${
              active
                ? 'text-orange-500 border-b-2 border-orange-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create DeleteAccountModal component**

```tsx
// components/settings/DeleteAccountModal.tsx
'use client'

import { useState } from 'react'

interface ImpactData {
  releaseCount: number
  totalSales: number
  activePreorders: number
}

interface Props {
  userType: 'fan' | 'artist'
  impactData?: ImpactData
  onConfirm: () => Promise<void>
  onCancel: () => void
  onDownload: () => void
  downloading: boolean
}

export function DeleteAccountModal({ userType, impactData, onConfirm, onCancel, onDownload, downloading }: Props) {
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isValid = confirmText === 'DELETE'

  async function handleConfirm() {
    if (!isValid) return
    setSubmitting(true)
    setError('')
    try {
      await onConfirm()
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
      onClick={() => !submitting && onCancel()}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-sm shrink-0">⚠</div>
          <h3 className="font-display text-lg font-bold">Delete your account?</h3>
        </div>

        {/* Artist impact stats */}
        {userType === 'artist' && impactData && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Impact Summary</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-bold">{impactData.releaseCount}</p>
                <p className="text-[10px] text-zinc-500">Releases</p>
              </div>
              <div>
                <p className="text-xl font-bold">{impactData.totalSales}</p>
                <p className="text-[10px] text-zinc-500">Total sales</p>
              </div>
              <div>
                <p className={`text-xl font-bold ${impactData.activePreorders > 0 ? 'text-orange-500' : ''}`}>
                  {impactData.activePreorders}
                </p>
                <p className={`text-[10px] ${impactData.activePreorders > 0 ? 'text-orange-500' : 'text-zinc-500'}`}>
                  Active pre-orders
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Warning text */}
        {userType === 'artist' ? (
          <div className="mb-4">
            <p className="text-xs font-bold text-zinc-300 mb-2">Deleting your account will:</p>
            <ul className="text-xs text-zinc-500 space-y-1.5 list-disc pl-4">
              <li>Remove all your releases from the platform</li>
              <li>Give existing purchasers <strong className="text-white">90 days</strong> to download their files</li>
              {impactData && impactData.activePreorders > 0 && (
                <li className="text-orange-500">
                  Cancel {impactData.activePreorders} active pre-order{impactData.activePreorders !== 1 ? 's' : ''} — fans will be refunded
                </li>
              )}
              <li>Remove your artist profile permanently</li>
              <li>Remove your fan account and library</li>
            </ul>
          </div>
        ) : (
          <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
            This will permanently delete your account, your library, your profile, and all associated data.
            Your purchased music will no longer be accessible through Insound.
            We recommend downloading your purchases before proceeding.{' '}
            <strong className="text-white">This cannot be undone.</strong>
          </p>
        )}

        {/* Stripe note for artists */}
        {userType === 'artist' && (
          <div className="bg-green-950/30 border border-green-900/40 rounded-lg p-3 mb-4">
            <p className="text-xs text-zinc-400">
              <strong className="text-green-400">Stripe:</strong> Your connected account will remain active until all pending payouts have settled, then it will be disconnected.
            </p>
          </div>
        )}

        {/* Download button */}
        <button
          onClick={onDownload}
          disabled={downloading}
          className="w-full bg-transparent border border-zinc-700 text-white py-3 rounded-xl text-sm font-bold mb-4 hover:border-zinc-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {downloading ? 'Generating links...' : '↓ Download all my music'}
        </button>

        {/* Type DELETE */}
        <div className="mb-4">
          <label className="text-xs text-zinc-500 block mb-2">
            Type <span className="text-red-400 font-bold">DELETE</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="DELETE"
            disabled={submitting}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-white placeholder-zinc-700 outline-none focus:border-red-600 transition-colors disabled:opacity-50"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 text-zinc-400 font-bold text-sm py-3 rounded-full border border-zinc-800 hover:border-zinc-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || !isValid}
            className="flex-1 bg-red-600 text-white font-bold text-sm py-3 rounded-full hover:bg-red-500 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Scheduling...' : 'Delete my account permanently'}
          </button>
        </div>

        <p className="text-[10px] text-zinc-600 text-center mt-4">
          Your account will be scheduled for deletion in 24 hours. You can cancel anytime before then.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create DeletionPendingBanner component**

```tsx
// components/settings/DeletionPendingBanner.tsx
'use client'

import { useState } from 'react'

interface Props {
  executeAt: string
  onCancel: () => Promise<void>
}

export function DeletionPendingBanner({ executeAt, onCancel }: Props) {
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')

  const date = new Date(executeAt)
  const formatted = date.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  async function handleCancel() {
    setCancelling(true)
    setError('')
    try {
      await onCancel()
    } catch (e) {
      setError((e as Error).message)
      setCancelling(false)
    }
  }

  return (
    <div className="border border-orange-500 bg-orange-950/20 rounded-xl p-5 mb-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-orange-500 mb-1">Account deletion scheduled</p>
          <p className="text-xs text-zinc-400">
            Your account will be permanently deleted on <strong className="text-white">{formatted}</strong>
          </p>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </div>
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="shrink-0 text-xs font-bold px-4 py-2 rounded-lg border border-orange-500 text-orange-500 hover:bg-orange-500/10 transition-colors disabled:opacity-50"
        >
          {cancelling ? 'Cancelling...' : 'Cancel deletion'}
        </button>
      </div>
      <p className="text-[10px] text-zinc-600 mt-3">
        A confirmation email has been sent. You'll receive a final reminder 1 hour before deletion.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/settings/SettingsTabs.tsx components/settings/DeleteAccountModal.tsx components/settings/DeletionPendingBanner.tsx
git commit -m "feat: shared account deletion UI components"
```

---

### Task 3: API Routes

**Files:**
- Create: `app/api/account/delete/route.ts`
- Create: `app/api/account/delete/download-links/route.ts`

- [ ] **Step 1: Create the main delete API route**

```ts
// app/api/account/delete/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

/** GET — returns pending deletion request + impact data (for artists) */
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check for pending deletion request
  const { data: pending } = await supabase
    .from('account_deletion_requests')
    .select('id, execute_at, requested_at')
    .eq('user_id', user.id)
    .eq('cancelled', false)
    .eq('executed', false)
    .maybeSingle()

  // Check if artist
  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  let impact = null
  if (artist) {
    const [releasesRes, salesRes, preordersRes] = await Promise.all([
      supabase.from('releases').select('id', { count: 'exact', head: true }).eq('artist_id', user.id),
      supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('artist_id', user.id).eq('status', 'paid'),
      supabase
        .from('purchases')
        .select('id, releases!inner(preorder_enabled, cancelled)', { count: 'exact', head: true })
        .eq('artist_id', user.id)
        .eq('status', 'paid')
        .eq('pre_order', true)
        .eq('releases.preorder_enabled', true)
        .eq('releases.cancelled', false),
    ])
    impact = {
      releaseCount: releasesRes.count ?? 0,
      totalSales: salesRes.count ?? 0,
      activePreorders: preordersRes.count ?? 0,
    }
  }

  return NextResponse.json({
    pending: pending ?? null,
    isArtist: !!artist,
    impact,
  })
}

/** POST — create a deletion request */
export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Determine user type
  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  const userType = artist ? 'artist' : 'fan'

  const { data: request, error: insertErr } = await supabase
    .from('account_deletion_requests')
    .insert({ user_id: user.id, user_type: userType })
    .select('id, execute_at')
    .single()

  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json({ error: 'A deletion request is already pending.' }, { status: 409 })
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Send confirmation email via Resend
  const cancelUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://getinsound.com'}/settings/account?cancel-deletion=true`
  const executeDate = new Date(request.execute_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Insound <noreply@getinsound.com>',
        to: [user.email],
        subject: 'Account deletion scheduled',
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="color:#FAFAFA;font-size:18px;line-height:1.6;padding-bottom:16px;">
          Your account is scheduled for deletion.
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:15px;line-height:1.6;padding-bottom:8px;">
          Your Insound account and all associated data will be permanently deleted on <strong style="color:#FAFAFA">${executeDate}</strong>.
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:15px;line-height:1.6;padding-bottom:32px;">
          We recommend downloading your purchased music before then. If you change your mind, you can cancel at any time before the deadline.
        </td></tr>
        <tr><td>
          <a href="${cancelUrl}" style="display:inline-block;background:#F56D00;color:#FAFAFA;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            Cancel deletion &rarr;
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      }),
    })
  } catch (e) {
    console.error('Deletion confirmation email failed:', (e as Error).message)
  }

  return NextResponse.json({ id: request.id, execute_at: request.execute_at })
}

/** DELETE — cancel a pending deletion request */
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error: updateErr } = await supabase
    .from('account_deletion_requests')
    .update({ cancelled: true })
    .eq('user_id', user.id)
    .eq('cancelled', false)
    .eq('executed', false)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Create the download-links API route**

```ts
// app/api/account/delete/download-links/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

const GRANT_EXPIRY_HOURS = 48
const GRANT_MAX_USES = 10

/** GET — generate download grants for all of a user's purchases */
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch all paid purchases with release + track info
  const { data: purchases, error: purchaseErr } = await supabase
    .from('purchases')
    .select(`
      id,
      releases (
        id, title, cover_url,
        artists!inner ( name ),
        tracks ( id, title, position, audio_path )
      )
    `)
    .eq('buyer_user_id', user.id)
    .eq('status', 'paid')

  if (purchaseErr) return NextResponse.json({ error: purchaseErr.message }, { status: 500 })
  if (!purchases || purchases.length === 0) return NextResponse.json({ releases: [] })

  const expiresAt = new Date(Date.now() + GRANT_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()

  // Create download grants for each purchase
  const results = []
  for (const purchase of purchases) {
    const release = purchase.releases as any
    if (!release) continue

    // Upsert a download grant
    const { data: grant, error: grantErr } = await supabase
      .from('download_grants')
      .upsert(
        { purchase_id: purchase.id, token: crypto.randomUUID(), expires_at: expiresAt, used_count: 0, max_uses: GRANT_MAX_USES },
        { onConflict: 'purchase_id' }
      )
      .select('token')
      .single()

    if (grantErr) {
      console.error('Grant creation failed for purchase', purchase.id, grantErr.message)
      continue
    }

    const artist = Array.isArray(release.artists) ? release.artists[0] : release.artists
    const tracks = [...(release.tracks ?? [])].sort((a: any, b: any) => a.position - b.position)

    results.push({
      releaseTitle: release.title,
      artistName: artist?.name ?? '',
      coverUrl: release.cover_url,
      downloadToken: grant.token,
      trackCount: tracks.length,
    })
  }

  return NextResponse.json({ releases: results, expiresAt })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/account/delete/route.ts app/api/account/delete/download-links/route.ts
git commit -m "feat: account deletion API routes — create, cancel, status, download links"
```

---

### Task 4: Fan Account Settings Page

**Files:**
- Create: `app/settings/account/page.tsx`
- Create: `app/settings/account/AccountSettingsClient.tsx`
- Modify: `app/settings/profile/ProfileSettingsClient.tsx`

- [ ] **Step 1: Create the server component page**

```tsx
// app/settings/account/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AccountSettingsClient } from './AccountSettingsClient'

export const metadata: Metadata = {
  title: 'Account Settings | Insound',
}

export default async function AccountSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signup')

  const { data: profile } = await supabase
    .from('fan_profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/welcome')

  // Check for pending deletion
  const { data: pending } = await supabase
    .from('account_deletion_requests')
    .select('id, execute_at')
    .eq('user_id', user.id)
    .eq('cancelled', false)
    .eq('executed', false)
    .maybeSingle()

  return (
    <AccountSettingsClient
      userEmail={user.email!}
      pendingDeletion={pending ?? null}
    />
  )
}
```

- [ ] **Step 2: Create the client component**

```tsx
// app/settings/account/AccountSettingsClient.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { resolveAccent, DEFAULT_ACCENT } from '@/lib/accent'
import { SettingsTabs } from '@/components/settings/SettingsTabs'
import { DeleteAccountModal } from '@/components/settings/DeleteAccountModal'
import { DeletionPendingBanner } from '@/components/settings/DeletionPendingBanner'

interface Props {
  userEmail: string
  pendingDeletion: { id: string; execute_at: string } | null
}

export function AccountSettingsClient({ userEmail, pendingDeletion }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showModal, setShowModal] = useState(false)
  const [pending, setPending] = useState(pendingDeletion)
  const [downloading, setDownloading] = useState(false)
  const resolvedAccent = resolveAccent(DEFAULT_ACCENT)

  // Auto-cancel from email link
  useEffect(() => {
    if (searchParams.get('cancel-deletion') === 'true' && pending) {
      handleCancel()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConfirm() {
    const res = await fetch('/api/account/delete', { method: 'POST' })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to schedule deletion')
    }
    const data = await res.json()
    setPending({ id: data.id, execute_at: data.execute_at })
    setShowModal(false)
  }

  async function handleCancel() {
    const res = await fetch('/api/account/delete', { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to cancel deletion')
    }
    setPending(null)
    router.replace('/settings/account')
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch('/api/account/delete/download-links')
      const data = await res.json()
      if (data.releases?.length > 0) {
        // Open download page or show links — for now open each grant in new tab
        for (const r of data.releases) {
          window.open(`/download/${r.downloadToken}`, '_blank')
        }
      }
    } catch (e) {
      console.error('Download failed:', e)
    }
    setDownloading(false)
  }

  return (
    <div className="min-h-screen flex flex-col relative"
      style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)', backgroundSize: '48px 48px' }}>

      <nav className="sticky top-0 w-full z-50 flex justify-between items-center px-6 md:px-14 py-5 border-b border-zinc-900/80"
        style={{ background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <Link href="/" className="text-2xl font-black tracking-tighter hover:text-orange-500 transition-colors font-display"
          style={{ color: resolvedAccent }}>
          insound.
        </Link>
        <Link href="/library"
          className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
          Library
        </Link>
      </nav>

      <div className="flex-1 flex items-start justify-center p-6 pt-12 relative">
        <div className="w-full max-w-lg relative z-10">
          <h1 className="font-display text-2xl font-bold mb-2">Settings</h1>
          <p className="text-zinc-500 text-sm mb-6">Manage your account.</p>

          <SettingsTabs />

          {/* Pending deletion banner */}
          {pending && (
            <DeletionPendingBanner
              executeAt={pending.execute_at}
              onCancel={handleCancel}
            />
          )}

          <div className="space-y-8">
            {/* Email */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Email</label>
              <p className="text-sm text-zinc-300">{userEmail}</p>
            </div>

            {/* Danger zone */}
            {!pending && (
              <div className="border border-red-900/30 bg-red-950/10 rounded-xl p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-4">Danger Zone</p>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold mb-1">Delete account</p>
                    <p className="text-xs text-zinc-500">Permanently delete your account and all associated data.</p>
                  </div>
                  <button
                    onClick={() => setShowModal(true)}
                    className="shrink-0 text-xs font-bold px-4 py-2 rounded-lg border border-red-600/40 text-red-400 bg-red-600/10 hover:bg-red-600/20 transition-colors"
                  >
                    Delete my account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <DeleteAccountModal
          userType="fan"
          onConfirm={handleConfirm}
          onCancel={() => setShowModal(false)}
          onDownload={handleDownload}
          downloading={downloading}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add SettingsTabs to the existing profile page**

In `app/settings/profile/ProfileSettingsClient.tsx`, add the import and render the tabs. After the `<h1>` and subtitle, insert the tabs:

Add at the top of the file with other imports:
```tsx
import { SettingsTabs } from '@/components/settings/SettingsTabs'
```

Then inside the `<div className="w-full max-w-lg relative z-10">` section, after the subtitle `<p>` tag and before `<div className="space-y-8">`, add:

```tsx
          <SettingsTabs />
```

Also change the `<h1>` text from `"Profile Settings"` to `"Settings"` and the subtitle to `"Manage your account."` for consistency. The page title will come from the tab.

- [ ] **Step 4: Commit**

```bash
git add app/settings/account/page.tsx app/settings/account/AccountSettingsClient.tsx app/settings/profile/ProfileSettingsClient.tsx
git commit -m "feat: fan account settings page with deletion flow"
```

---

### Task 5: Artist Dashboard Settings Page

**Files:**
- Create: `app/dashboard/settings/page.tsx`
- Create: `app/dashboard/settings/DashboardSettingsClient.tsx`

- [ ] **Step 1: Create the server component page**

```tsx
// app/dashboard/settings/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardSettingsClient } from './DashboardSettingsClient'

export const runtime = 'edge'
export const metadata = { title: 'Account Settings | Insound' }

export default async function DashboardSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signup')

  const [artistRes, accountRes, pendingRes] = await Promise.all([
    supabase.from('artists').select('id, name').eq('id', user.id).maybeSingle(),
    supabase.from('artist_accounts').select('stripe_account_id, stripe_onboarded').eq('id', user.id).maybeSingle(),
    supabase
      .from('account_deletion_requests')
      .select('id, execute_at')
      .eq('user_id', user.id)
      .eq('cancelled', false)
      .eq('executed', false)
      .maybeSingle(),
  ])

  if (!artistRes.data || !accountRes.data) redirect('/become-an-artist')

  // Fetch impact data
  const [releasesRes, salesRes, preordersRes] = await Promise.all([
    supabase.from('releases').select('id', { count: 'exact', head: true }).eq('artist_id', user.id),
    supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('artist_id', user.id).eq('status', 'paid'),
    supabase
      .from('purchases')
      .select('id, releases!inner(preorder_enabled, cancelled)', { count: 'exact', head: true })
      .eq('artist_id', user.id)
      .eq('status', 'paid')
      .eq('pre_order', true)
      .eq('releases.preorder_enabled', true)
      .eq('releases.cancelled', false),
  ])

  return (
    <DashboardSettingsClient
      userEmail={user.email!}
      artistName={artistRes.data.name}
      stripeConnected={accountRes.data.stripe_onboarded}
      stripeAccountId={accountRes.data.stripe_account_id}
      pendingDeletion={pendingRes.data ?? null}
      impact={{
        releaseCount: releasesRes.count ?? 0,
        totalSales: salesRes.count ?? 0,
        activePreorders: preordersRes.count ?? 0,
      }}
    />
  )
}
```

- [ ] **Step 2: Create the client component**

```tsx
// app/dashboard/settings/DashboardSettingsClient.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { DeleteAccountModal } from '@/components/settings/DeleteAccountModal'
import { DeletionPendingBanner } from '@/components/settings/DeletionPendingBanner'

interface Props {
  userEmail: string
  artistName: string
  stripeConnected: boolean
  stripeAccountId: string | null
  pendingDeletion: { id: string; execute_at: string } | null
  impact: { releaseCount: number; totalSales: number; activePreorders: number }
}

export function DashboardSettingsClient({
  userEmail, artistName, stripeConnected, stripeAccountId,
  pendingDeletion, impact,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showModal, setShowModal] = useState(false)
  const [pending, setPending] = useState(pendingDeletion)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (searchParams.get('cancel-deletion') === 'true' && pending) {
      handleCancel()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConfirm() {
    const res = await fetch('/api/account/delete', { method: 'POST' })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to schedule deletion')
    }
    const data = await res.json()
    setPending({ id: data.id, execute_at: data.execute_at })
    setShowModal(false)
  }

  async function handleCancel() {
    const res = await fetch('/api/account/delete', { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to cancel deletion')
    }
    setPending(null)
    router.replace('/dashboard/settings')
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch('/api/account/delete/download-links')
      const data = await res.json()
      if (data.releases?.length > 0) {
        for (const r of data.releases) {
          window.open(`/download/${r.downloadToken}`, '_blank')
        }
      }
    } catch (e) {
      console.error('Download failed:', e)
    }
    setDownloading(false)
  }

  return (
    <div className="min-h-screen flex flex-col relative"
      style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)', backgroundSize: '48px 48px' }}>

      <nav className="sticky top-0 w-full z-50 flex justify-between items-center px-6 md:px-14 py-5 border-b border-zinc-900/80"
        style={{ background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <Link href="/" className="text-2xl font-black tracking-tighter hover:text-orange-500 transition-colors font-display"
          style={{ color: '#F56D00' }}>
          insound.
        </Link>
        <Link href="/dashboard"
          className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
          Back to Dashboard
        </Link>
      </nav>

      <div className="flex-1 flex items-start justify-center p-6 pt-12 relative">
        <div className="w-full max-w-lg relative z-10">
          <h1 className="font-display text-2xl font-bold mb-2">Account Settings</h1>
          <p className="text-zinc-500 text-sm mb-8">{artistName}</p>

          {/* Pending deletion banner */}
          {pending && (
            <DeletionPendingBanner
              executeAt={pending.execute_at}
              onCancel={handleCancel}
            />
          )}

          <div className="space-y-8">
            {/* Email */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Email</label>
              <p className="text-sm text-zinc-300">{userEmail}</p>
            </div>

            {/* Stripe status */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Stripe Connect</label>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${stripeConnected ? 'bg-green-500' : 'bg-zinc-600'}`} />
                <p className="text-sm text-zinc-300">
                  {stripeConnected ? `Connected — ${stripeAccountId}` : 'Not connected'}
                </p>
              </div>
            </div>

            {/* Danger zone */}
            {!pending && (
              <div className="border border-red-900/30 bg-red-950/10 rounded-xl p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-4">Danger Zone</p>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold mb-1">Delete account</p>
                    <p className="text-xs text-zinc-500">Permanently delete your artist profile, releases, and fan account.</p>
                  </div>
                  <button
                    onClick={() => setShowModal(true)}
                    className="shrink-0 text-xs font-bold px-4 py-2 rounded-lg border border-red-600/40 text-red-400 bg-red-600/10 hover:bg-red-600/20 transition-colors"
                  >
                    Delete my account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <DeleteAccountModal
          userType="artist"
          impactData={impact}
          onConfirm={handleConfirm}
          onCancel={() => setShowModal(false)}
          onDownload={handleDownload}
          downloading={downloading}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/settings/page.tsx app/dashboard/settings/DashboardSettingsClient.tsx
git commit -m "feat: artist dashboard settings page with deletion flow"
```

---

### Task 6: Edge Function — send-last-chance-email

**Files:**
- Create: `supabase/functions/send-last-chance-email/index.ts`

- [ ] **Step 1: Write the edge function**

```ts
// supabase/functions/send-last-chance-email/index.ts
// Triggered by pg_cron every minute.
// Finds deletion requests within 1 hour of execution, sends warning email.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://getinsound.com';

Deno.serve(async (req) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Verify this is called with service role (from pg_cron)
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  // Find requests needing last-chance email
  const { data: requests, error } = await admin
    .from('account_deletion_requests')
    .select('id, user_id, execute_at')
    .eq('cancelled', false)
    .eq('executed', false)
    .eq('last_chance_sent', false)
    .lte('execute_at', new Date(Date.now() + 60 * 60 * 1000).toISOString())
    .gt('execute_at', new Date().toISOString());

  if (error) {
    console.error('Query failed:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!requests || requests.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }));
  }

  let sent = 0;
  for (const request of requests) {
    // Get user email
    const { data: { user } } = await admin.auth.admin.getUserById(request.user_id);
    if (!user?.email) continue;

    const executeDate = new Date(request.execute_at).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const cancelUrl = `${SITE_URL}/settings/account?cancel-deletion=true`;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Insound <noreply@getinsound.com>',
          to: [user.email],
          subject: 'Your account will be deleted in 1 hour',
          html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="color:#FAFAFA;font-size:18px;line-height:1.6;padding-bottom:16px;">
          Your Insound account will be permanently deleted in 1 hour.
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:15px;line-height:1.6;padding-bottom:32px;">
          Scheduled deletion: <strong style="color:#FAFAFA">${escapeHtml(executeDate)}</strong>. If you&rsquo;ve changed your mind, click below to cancel.
        </td></tr>
        <tr><td>
          <a href="${cancelUrl}" style="display:inline-block;background:#F56D00;color:#FAFAFA;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            Cancel deletion &rarr;
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        }),
      });

      await admin
        .from('account_deletion_requests')
        .update({ last_chance_sent: true })
        .eq('id', request.id);

      sent++;
    } catch (e) {
      console.error(`Last chance email failed for ${request.id}:`, (e as Error).message);
    }
  }

  return new Response(JSON.stringify({ processed: sent }));
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/send-last-chance-email/index.ts
git commit -m "feat: edge function — send last-chance deletion warning email"
```

---

### Task 7: Edge Function — process-account-deletion

**Files:**
- Create: `supabase/functions/process-account-deletion/index.ts`

- [ ] **Step 1: Write the edge function**

```ts
// supabase/functions/process-account-deletion/index.ts
// Triggered by pg_cron every minute.
// Finds deletion requests past execute_at, processes full deletion.

import Stripe from 'npm:stripe@17';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://getinsound.com';
const DOWNLOAD_GRANT_EXPIRY_HOURS = 48;
const DOWNLOAD_GRANT_MAX_USES = 10;
const ARTIST_CONTENT_RETAIN_DAYS = 90;

Deno.serve(async (req) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  // Find requests ready for execution
  const { data: requests, error } = await admin
    .from('account_deletion_requests')
    .select('id, user_id, user_type')
    .eq('cancelled', false)
    .eq('executed', false)
    .lte('execute_at', new Date().toISOString());

  if (error) {
    console.error('Query failed:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!requests || requests.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }));
  }

  let processed = 0;
  for (const request of requests) {
    try {
      // Re-check cancelled status (race condition guard)
      const { data: fresh } = await admin
        .from('account_deletion_requests')
        .select('cancelled')
        .eq('id', request.id)
        .single();

      if (fresh?.cancelled) continue;

      // Get user email before we delete anything
      const { data: { user } } = await admin.auth.admin.getUserById(request.user_id);
      if (!user) {
        await markExecuted(admin, request.id);
        continue;
      }
      const userEmail = user.email!;

      // ── ARTIST DELETION STEPS ────────────────────────────
      if (request.user_type === 'artist') {
        await processArtistDeletion(admin, request.user_id, request.id);
      }

      // ── FAN DELETION STEPS ───────────────────────────────

      // 1. Generate download grants for all purchases
      const downloadLinks = await generateDownloadGrants(admin, request.user_id);

      // 2. Anonymise purchases
      await admin
        .from('purchases')
        .update({ buyer_user_id: null, buyer_email: 'deleted@anonymised' })
        .eq('buyer_user_id', request.user_id);

      // 3. Delete fan_profiles (cascades: fan_preferences, fan_pinned_releases, fan_badges, fan_hidden_purchases)
      await admin
        .from('fan_profiles')
        .delete()
        .eq('id', request.user_id);

      // 4. Delete avatar from storage
      const { data: avatarFiles } = await admin.storage
        .from('avatars')
        .list(request.user_id);

      if (avatarFiles && avatarFiles.length > 0) {
        await admin.storage
          .from('avatars')
          .remove(avatarFiles.map(f => `${request.user_id}/${f.name}`));
      }

      // 5. Delete auth user
      await admin.auth.admin.deleteUser(request.user_id);

      // 6. Send deletion complete email
      await sendDeletionCompleteEmail(userEmail, downloadLinks);

      // 7. Mark as executed
      await markExecuted(admin, request.id);

      processed++;
    } catch (e) {
      console.error(`Deletion failed for request ${request.id}:`, (e as Error).message);
      // Log to webhook_errors for debugging
      await admin.from('webhook_errors').insert({
        event_type: 'account_deletion',
        event_id: request.id,
        payload: { user_id: request.user_id, user_type: request.user_type },
        error: (e as Error).message,
      });
    }
  }

  return new Response(JSON.stringify({ processed }));
});

async function processArtistDeletion(
  admin: ReturnType<typeof createClient>,
  userId: string,
  requestId: string,
) {
  // 1. Cancel active pre-orders and refund
  const { data: preorderPurchases } = await admin
    .from('purchases')
    .select('id, stripe_pi_id, buyer_email, amount_pence, releases!inner(id, title, preorder_enabled, cancelled)')
    .eq('artist_id', userId)
    .eq('status', 'paid')
    .eq('pre_order', true)
    .eq('releases.preorder_enabled', true)
    .eq('releases.cancelled', false);

  const refundEmails: { to: string; release: string; amount: number }[] = [];

  for (const p of preorderPurchases ?? []) {
    if (p.stripe_pi_id) {
      try {
        await stripe.refunds.create({ payment_intent: p.stripe_pi_id });
        await admin.from('purchases').update({ status: 'refunded' }).eq('id', p.id);
        if (p.buyer_email && p.buyer_email !== 'deleted@anonymised') {
          const release = Array.isArray(p.releases) ? p.releases[0] : p.releases;
          refundEmails.push({
            to: p.buyer_email,
            release: (release as any)?.title ?? 'Unknown',
            amount: p.amount_pence,
          });
        }
      } catch (e) {
        console.error(`Refund failed for purchase ${p.id}:`, (e as Error).message);
      }
    }
  }

  // Send refund notification emails
  if (refundEmails.length > 0) {
    const emailBatch = refundEmails.map(r => ({
      from: 'Insound <noreply@getinsound.com>',
      to: [r.to],
      subject: 'Your pre-order has been refunded',
      html: buildRefundEmail(r.release, r.amount),
    }));

    try {
      await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify(emailBatch),
      });
    } catch (e) {
      console.error('Refund emails failed:', (e as Error).message);
    }
  }

  // 2. Mark all releases as deleted with 90-day retention
  const retainUntil = new Date(Date.now() + ARTIST_CONTENT_RETAIN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await admin
    .from('releases')
    .update({ visibility: 'deleted', deletion_retain_until: retainUntil })
    .eq('artist_id', userId);

  // 3. Anonymise artist sales records (keep financial data)
  await admin
    .from('purchases')
    .update({ buyer_email: 'deleted@anonymised', buyer_user_id: null })
    .eq('artist_id', userId)
    .neq('buyer_email', 'deleted@anonymised');

  // 4. Delete artist posts + post-media storage
  await admin.from('artist_posts').delete().eq('artist_id', userId);
  const { data: postMedia } = await admin.storage.from('post-media').list(userId);
  if (postMedia && postMedia.length > 0) {
    await admin.storage.from('post-media').remove(postMedia.map(f => `${userId}/${f.name}`));
  }

  // 5. Check Stripe balance and disconnect if possible
  const { data: account } = await admin
    .from('artist_accounts')
    .select('stripe_account_id')
    .eq('id', userId)
    .maybeSingle();

  if (account?.stripe_account_id) {
    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: account.stripe_account_id,
      });
      const totalAvailable = balance.available.reduce((s, b) => s + b.amount, 0);
      const totalPending = balance.pending.reduce((s, b) => s + b.amount, 0);

      if (totalAvailable === 0 && totalPending === 0) {
        // Safe to disconnect
        await stripe.accounts.del(account.stripe_account_id);
      } else {
        // Defer disconnect
        await admin
          .from('account_deletion_requests')
          .update({ stripe_pending_disconnect: true })
          .eq('id', requestId);
      }
    } catch (e) {
      console.error('Stripe disconnect check failed:', (e as Error).message);
      await admin
        .from('account_deletion_requests')
        .update({ stripe_pending_disconnect: true })
        .eq('id', requestId);
    }
  }

  // 6. Delete artist_accounts and artists rows
  await admin.from('artist_accounts').delete().eq('id', userId);
  await admin.from('artists').delete().eq('id', userId);
}

async function generateDownloadGrants(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ releaseTitle: string; token: string }[]> {
  const { data: purchases } = await admin
    .from('purchases')
    .select('id, releases(title)')
    .eq('buyer_user_id', userId)
    .eq('status', 'paid');

  if (!purchases || purchases.length === 0) return [];

  const expiresAt = new Date(Date.now() + DOWNLOAD_GRANT_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
  const grants: { releaseTitle: string; token: string }[] = [];

  for (const p of purchases) {
    const token = crypto.randomUUID();
    const { error } = await admin
      .from('download_grants')
      .upsert(
        { purchase_id: p.id, token, expires_at: expiresAt, used_count: 0, max_uses: DOWNLOAD_GRANT_MAX_USES },
        { onConflict: 'purchase_id' }
      );

    if (!error) {
      const release = Array.isArray(p.releases) ? p.releases[0] : p.releases;
      grants.push({ releaseTitle: (release as any)?.title ?? 'Unknown', token });
    }
  }

  return grants;
}

async function sendDeletionCompleteEmail(
  email: string,
  downloadLinks: { releaseTitle: string; token: string }[],
) {
  const linksHtml = downloadLinks.length > 0
    ? `<tr><td style="color:#A1A1AA;font-size:15px;line-height:1.6;padding-bottom:24px;">
        Your download links are active for 48 hours:
      </td></tr>` +
      downloadLinks.map(l =>
        `<tr><td style="padding-bottom:8px;">
          <a href="${SITE_URL}/download/${l.token}" style="color:#F56D00;font-size:14px;text-decoration:none;">
            ${escapeHtml(l.releaseTitle)} &rarr;
          </a>
        </td></tr>`
      ).join('')
    : '';

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Insound <noreply@getinsound.com>',
        to: [email],
        subject: 'Your Insound account has been deleted',
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="color:#FAFAFA;font-size:18px;line-height:1.6;padding-bottom:16px;">
          Your Insound account has been permanently deleted.
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:15px;line-height:1.6;padding-bottom:24px;">
          All your personal data has been removed from our systems.
        </td></tr>
        ${linksHtml}
        <tr><td style="padding-top:16px;">
          <a href="${SITE_URL}" style="display:inline-block;background:#F56D00;color:#FAFAFA;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            Visit Insound &rarr;
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      }),
    });
  } catch (e) {
    console.error('Deletion complete email failed:', (e as Error).message);
  }
}

async function markExecuted(admin: ReturnType<typeof createClient>, requestId: string) {
  await admin
    .from('account_deletion_requests')
    .update({ executed: true, executed_at: new Date().toISOString() })
    .eq('id', requestId);
}

function buildRefundEmail(releaseTitle: string, amountPence: number): string {
  const amount = `£${(amountPence / 100).toFixed(2)}`;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="color:#FAFAFA;font-size:18px;line-height:1.6;padding-bottom:16px;">
          Your pre-order has been refunded.
        </td></tr>
        <tr><td style="color:#A1A1AA;font-size:15px;line-height:1.6;padding-bottom:32px;">
          The artist has closed their account. Your pre-order for <strong style="color:#FAFAFA">${escapeHtml(releaseTitle)}</strong> has been cancelled and a full refund of ${amount} has been issued. It should appear in your account within 5&ndash;10 business days.
        </td></tr>
        <tr><td>
          <a href="${SITE_URL}/explore" style="display:inline-block;background:#F56D00;color:#FAFAFA;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
            Discover more music &rarr;
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/process-account-deletion/index.ts
git commit -m "feat: edge function — process account deletion (fan + artist flows)"
```

---

### Task 8: Edge Function — cleanup-deleted-content

**Files:**
- Create: `supabase/functions/cleanup-deleted-content/index.ts`

- [ ] **Step 1: Write the edge function**

```ts
// supabase/functions/cleanup-deleted-content/index.ts
// Triggered by pg_cron daily at 3am UTC.
// Removes expired artist files from storage, deletes release/track rows.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  // Find releases past retention period
  const { data: releases, error } = await admin
    .from('releases')
    .select('id, artist_id, tracks(id, audio_path, preview_path), cover_url')
    .eq('visibility', 'deleted')
    .lte('deletion_retain_until', new Date().toISOString());

  if (error) {
    console.error('Query failed:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!releases || releases.length === 0) {
    return new Response(JSON.stringify({ cleaned: 0 }));
  }

  let cleaned = 0;
  for (const release of releases) {
    try {
      // Remove master and preview audio files
      const tracks = release.tracks ?? [];
      const masterPaths = tracks.map((t: any) => t.audio_path).filter(Boolean);
      const previewPaths = tracks.map((t: any) => t.preview_path).filter(Boolean);

      if (masterPaths.length > 0) {
        await admin.storage.from('masters').remove(masterPaths);
      }
      if (previewPaths.length > 0) {
        await admin.storage.from('previews').remove(previewPaths);
      }

      // Remove cover art
      if (release.cover_url) {
        // Extract path from public URL: covers/{artist_id}/{filename}
        const coverPath = release.cover_url.split('/covers/')[1];
        if (coverPath) {
          await admin.storage.from('covers').remove([coverPath]);
        }
      }

      // Delete the release row (cascades to tracks, download_grants, download_codes)
      await admin.from('releases').delete().eq('id', release.id);

      cleaned++;
    } catch (e) {
      console.error(`Cleanup failed for release ${release.id}:`, (e as Error).message);
    }
  }

  return new Response(JSON.stringify({ cleaned }));
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/cleanup-deleted-content/index.ts
git commit -m "feat: edge function — cleanup expired deleted artist content"
```

---

### Task 9: Edge Function — retry-stripe-disconnect

**Files:**
- Create: `supabase/functions/retry-stripe-disconnect/index.ts`

- [ ] **Step 1: Write the edge function**

```ts
// supabase/functions/retry-stripe-disconnect/index.ts
// Triggered by pg_cron daily at 4am UTC.
// Retries Stripe account disconnection for settled accounts.

import Stripe from 'npm:stripe@17';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

Deno.serve(async (req) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  // Find requests with pending Stripe disconnect
  const { data: requests, error } = await admin
    .from('account_deletion_requests')
    .select('id, user_id')
    .eq('stripe_pending_disconnect', true)
    .eq('executed', true);

  if (error) {
    console.error('Query failed:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!requests || requests.length === 0) {
    return new Response(JSON.stringify({ disconnected: 0 }));
  }

  let disconnected = 0;
  for (const request of requests) {
    // The artist_accounts row may already be deleted, so we need to find
    // the Stripe account ID another way. Check if it was stored.
    // Since artist_accounts is deleted during deletion, we need to look at
    // Stripe directly. We stored the account in the request metadata... 
    // Actually, the artist_accounts row is deleted during deletion.
    // We need to store the stripe_account_id on the deletion request.
    // For now, skip if we can't find it.

    // Try to find via Stripe connected accounts list
    // This is a limitation — in production, store stripe_account_id on the request.
    // For now, mark as resolved since the artist data is already deleted.
    try {
      // The account_deletion_requests doesn't store stripe_account_id.
      // The artist_accounts row was deleted. We can't disconnect.
      // Mark as resolved — the Stripe Express account will be cleaned up
      // via Stripe's own inactivity policies.
      await admin
        .from('account_deletion_requests')
        .update({ stripe_pending_disconnect: false })
        .eq('id', request.id);
      disconnected++;
    } catch (e) {
      console.error(`Stripe disconnect retry failed for ${request.id}:`, (e as Error).message);
    }
  }

  return new Response(JSON.stringify({ disconnected }));
});
```

**Note:** This reveals a design gap — we need to store the `stripe_account_id` on the deletion request before deleting `artist_accounts`. Let's fix this.

- [ ] **Step 2: Add stripe_account_id column to account_deletion_requests**

In `supabase/migrations/0017_account_deletion.sql`, add to the table definition:

```sql
  stripe_account_id text
```

And in `process-account-deletion/index.ts`, before deleting `artist_accounts`, store the Stripe account ID on the deletion request:

In the `processArtistDeletion` function, right after the account query that gets `stripe_account_id`, add:

```ts
  if (account?.stripe_account_id) {
    await admin
      .from('account_deletion_requests')
      .update({ stripe_account_id: account.stripe_account_id })
      .eq('id', requestId);
    // ... rest of Stripe logic
  }
```

Then rewrite `retry-stripe-disconnect/index.ts`:

```ts
// supabase/functions/retry-stripe-disconnect/index.ts
import Stripe from 'npm:stripe@17';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

Deno.serve(async (req) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const { data: requests, error } = await admin
    .from('account_deletion_requests')
    .select('id, stripe_account_id')
    .eq('stripe_pending_disconnect', true)
    .eq('executed', true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!requests || requests.length === 0) {
    return new Response(JSON.stringify({ disconnected: 0 }));
  }

  let disconnected = 0;
  for (const request of requests) {
    if (!request.stripe_account_id) {
      await admin
        .from('account_deletion_requests')
        .update({ stripe_pending_disconnect: false })
        .eq('id', request.id);
      disconnected++;
      continue;
    }

    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: request.stripe_account_id,
      });
      const totalAvailable = balance.available.reduce((s, b) => s + b.amount, 0);
      const totalPending = balance.pending.reduce((s, b) => s + b.amount, 0);

      if (totalAvailable === 0 && totalPending === 0) {
        await stripe.accounts.del(request.stripe_account_id);
        await admin
          .from('account_deletion_requests')
          .update({ stripe_pending_disconnect: false })
          .eq('id', request.id);
        disconnected++;
      }
    } catch (e) {
      console.error(`Stripe disconnect retry failed for ${request.id}:`, (e as Error).message);
    }
  }

  return new Response(JSON.stringify({ disconnected }));
});
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/retry-stripe-disconnect/index.ts supabase/migrations/0017_account_deletion.sql supabase/functions/process-account-deletion/index.ts
git commit -m "feat: edge function — retry Stripe disconnect + store stripe_account_id on request"
```

---

### Task 10: Update Spec and Privacy Policy

**Files:**
- Modify: `docs/superpowers/specs/2026-04-23-account-deletion-design.md`
- Modify: `app/terms/page.tsx` (or wherever the privacy policy lives)

- [ ] **Step 1: Update the spec to include stripe_account_id column**

Add `stripe_account_id text` to the `account_deletion_requests` table definition in the spec.

- [ ] **Step 2: Add privacy policy section about account deletion**

Find the privacy policy page and add a section documenting:
- Users can delete their accounts via Settings > Account
- Purchases are anonymised rather than hard-deleted to preserve aggregate analytics
- Artist sales records retain financial amounts for accounting but PII is removed
- Deleted artist content is retained for 90 days for existing purchasers, then permanently removed
- 24-hour cooldown period before deletion is processed
- Download links are provided for 48 hours after deletion

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-04-23-account-deletion-design.md app/terms/page.tsx
git commit -m "docs: update spec with stripe_account_id, add privacy policy deletion section"
```

---

### Task 11: Integration Testing

- [ ] **Step 1: Start dev server and verify fan flow**

Run: `npm run dev`

1. Log in as a fan account
2. Navigate to `/settings/account`
3. Verify the Account tab appears and is active
4. Verify the Profile tab links to `/settings/profile`
5. Click "Delete my account"
6. Verify the modal shows with fan-specific text
7. Type "DELETE" — verify the confirm button enables
8. Click confirm — verify the pending banner appears
9. Click "Cancel deletion" — verify the banner disappears

- [ ] **Step 2: Verify artist flow**

1. Log in as an artist account
2. Navigate to `/dashboard/settings`
3. Verify Stripe status shows
4. Click "Delete my account"
5. Verify impact assessment shows (release count, sales, pre-orders)
6. Verify pre-order warning if applicable
7. Type "DELETE" and confirm
8. Verify pending banner

- [ ] **Step 3: Verify email link cancellation**

1. With a pending deletion, navigate to `/settings/account?cancel-deletion=true`
2. Verify the deletion is automatically cancelled

- [ ] **Step 4: Verify SettingsTabs on profile page**

1. Navigate to `/settings/profile`
2. Verify the Profile/Account tabs appear
3. Verify clicking Account navigates to `/settings/account`

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration testing adjustments"
```
