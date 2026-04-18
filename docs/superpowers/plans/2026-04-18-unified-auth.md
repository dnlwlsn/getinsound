# Unified Auth Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the artist-only signup with a single email-based magic link flow where everyone is a user first and artist capabilities unlock via an upgrade path.

**Architecture:** Supabase Auth with magic links (OTP via email). The existing `on_auth_user_created` trigger is replaced — it no longer auto-creates `artists`/`artist_accounts` rows. Instead it creates a `fan_profiles` row for every new user. Artist rows are created later during the explicit upgrade flow at `/become-an-artist`. Middleware gains route protection for artist-only pages. A `?intent=artist` query param on `/signup` enables post-login redirect to `/become-an-artist`.

**Tech Stack:** Next.js 15 App Router, Supabase Auth (magic link / OTP), Supabase PostgreSQL, TypeScript, Tailwind CSS

---

## File Structure

### New files
- `app/signup/page.tsx` — server component, renders SignupClient
- `app/signup/SignupClient.tsx` — email-only magic link signup form
- `app/auth/callback/route.ts` — handles magic link token exchange, redirects based on intent
- `app/welcome/page.tsx` — server component, checks auth + first-login status
- `app/welcome/WelcomeClient.tsx` — two-CTA welcome screen
- `app/become-an-artist/page.tsx` — server component, guards against already-upgraded users
- `app/become-an-artist/BecomeArtistClient.tsx` — artist upgrade onboarding form
- `lib/auth.ts` — shared helper: `getUserRole(supabase, userId)` returns `{ isArtist, artistSlug }`
- `supabase/migrations/0011_unified_auth.sql` — schema changes + trigger replacement

### Modified files
- `middleware.ts` — add route protection for artist-only pages + welcome redirect for first login
- `app/auth/AuthClient.tsx` — rewrite: remove signup tab, keep sign-in (email+password for existing users + magic link option)
- `app/auth/page.tsx` — update metadata
- `app/dashboard/page.tsx` — use `lib/auth.ts` helper, redirect non-artists to `/become-an-artist`
- `app/for-artists/ForArtistsClient.tsx` — change CTA from waitlist to `/signup?intent=artist`
- `app/components/HomeClient.tsx` — update nav CTA link from `/auth` to `/signup`
- `app/layout.tsx` — no changes needed (no auth provider required)

### Deleted files
- None (we modify `/auth` rather than deleting it — existing password-based users still need to sign in)

---

## Task 1: Database Migration — Unified Auth Schema

**Files:**
- Create: `supabase/migrations/0011_unified_auth.sql`

This migration: (a) adds columns to `fan_profiles` for the new fields, (b) replaces the auth trigger to create `fan_profiles` instead of `artists`/`artist_accounts`, and (c) adds a helper function to check if a user is an artist.

- [ ] **Step 1: Write the migration SQL**

```sql
-- 0011_unified_auth.sql
-- Unified auth: every signup creates a fan_profiles row.
-- Artist rows are created explicitly during the upgrade flow.

-- 1. Add new columns to fan_profiles
alter table public.fan_profiles
  add column if not exists username text,
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists accent_colour text,
  add column if not exists is_public boolean not null default true,
  add column if not exists show_purchase_amounts boolean not null default false,
  add column if not exists has_seen_welcome boolean not null default false;

-- 2. Replace the auth trigger to create fan_profiles (not artists)
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.fan_profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3. Add default_currency to artists table for the upgrade flow
alter table public.artists
  add column if not exists default_currency text not null default 'GBP';
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db push` or apply via the Supabase Dashboard SQL Editor.

Expected: Migration applies without errors. Existing users are unaffected — their `artists` and `artist_accounts` rows remain. New signups will get `fan_profiles` rows instead.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0011_unified_auth.sql
git commit -m "feat: unified auth migration — fan_profiles on signup, not artists"
```

---

## Task 2: Auth Helper — `getUserRole`

**Files:**
- Create: `lib/auth.ts`

A shared helper used by middleware, server components, and the upgrade flow to determine whether a user has an artist profile.

- [ ] **Step 1: Create the helper**

```typescript
// lib/auth.ts
import { SupabaseClient } from '@supabase/supabase-js'

export type UserRole = {
  isArtist: boolean
  artistSlug: string | null
  hasSeenWelcome: boolean
}

export async function getUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<UserRole> {
  const [artistRes, profileRes] = await Promise.all([
    supabase
      .from('artists')
      .select('slug')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('fan_profiles')
      .select('has_seen_welcome')
      .eq('id', userId)
      .maybeSingle(),
  ])

  return {
    isArtist: !!artistRes.data,
    artistSlug: artistRes.data?.slug ?? null,
    hasSeenWelcome: profileRes.data?.has_seen_welcome ?? false,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/auth.ts
git commit -m "feat: add getUserRole helper for unified auth"
```

---

## Task 3: Auth Callback Route — Magic Link Token Exchange

**Files:**
- Create: `app/auth/callback/route.ts`

Supabase magic links redirect to `/auth/callback?code=...`. This route exchanges the code for a session, then redirects based on intent (stored in the magic link's `redirectTo` param).

- [ ] **Step 1: Create the callback route**

```typescript
// app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/welcome'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth failed — redirect to signup with error
  return NextResponse.redirect(`${origin}/signup?error=auth`)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/auth/callback/route.ts
git commit -m "feat: auth callback route for magic link token exchange"
```

---

## Task 4: Signup Page — Email-Only Magic Link

**Files:**
- Create: `app/signup/page.tsx`
- Create: `app/signup/SignupClient.tsx`

Single-field email signup. Sends a magic link via Supabase Auth. If `?intent=artist` is present, the magic link's redirect URL includes `?next=/become-an-artist` so the callback route sends them to the upgrade flow after login.

- [ ] **Step 1: Create the server component**

```typescript
// app/signup/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignupClient } from './SignupClient'

export const metadata: Metadata = {
  title: 'Join Insound',
  description: 'Sign up to Insound — the music platform that pays artists.',
}

export default async function SignupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/welcome')

  return <SignupClient />
}
```

- [ ] **Step 2: Create the client component**

```typescript
// app/signup/SignupClient.tsx
'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export function SignupClient() {
  const searchParams = useSearchParams()
  const intent = searchParams.get('intent')
  const authError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<'form' | 'sent' | 'error'>('form')
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return

    setSending(true)
    setErrorMsg('')

    const redirectPath = intent === 'artist' ? '/become-an-artist' : '/welcome'

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${redirectPath}`,
      },
    })

    if (error) {
      setErrorMsg(error.message)
      setPhase('error')
    } else {
      setPhase('sent')
    }
    setSending(false)
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)', backgroundSize: '48px 48px' }}>
      {/* Nav */}
      <nav className="sticky top-0 w-full z-50 flex justify-between items-center px-6 md:px-14 py-5 border-b border-zinc-900/80" style={{ background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <Link href="/" className="text-2xl font-black text-orange-600 tracking-tighter hover:text-orange-500 transition-colors font-display">
          insound.
        </Link>
        <div className="flex gap-3 items-center">
          <Link href="/auth" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">Sign In</Link>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(234,88,12,0.05),transparent_60%)]" />

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <Link href="/" className="text-3xl font-black text-orange-600 tracking-tighter hover:text-orange-500 transition-colors font-display">
              insound.
            </Link>
            <p className="text-zinc-500 mt-2 font-medium text-sm">
              {intent === 'artist' ? 'Start selling your music.' : 'Independent music, directly supported.'}
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl" style={{ boxShadow: '0 0 60px rgba(234,88,12,0.08)' }}>

            {phase === 'form' && (
              <>
                <h2 className="font-display text-xl font-bold text-center mb-2">Join Insound</h2>
                <p className="text-zinc-500 text-sm text-center mb-8">We&apos;ll send you a magic link to sign in.</p>

                {authError && (
                  <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-3 mb-5">
                    Something went wrong. Please try again.
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Email Address</label>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {sending ? 'Sending...' : 'Continue with email →'}
                  </button>
                </form>

                <p className="text-center text-zinc-600 text-xs mt-6">
                  Already have an account? <Link href="/auth" className="text-orange-600 hover:text-orange-400">Sign in</Link>
                </p>
              </>
            )}

            {phase === 'sent' && (
              <div className="text-center py-4">
                <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-orange-600/15 border border-orange-600/40 flex items-center justify-center">
                  <svg width="24" height="24" fill="none" stroke="#ea580c" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-black text-white mb-2 font-display">Check your inbox</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  We sent a magic link to <span className="text-white font-semibold">{email.trim()}</span>. Click it to sign in.
                </p>
              </div>
            )}

            {phase === 'error' && (
              <div className="text-center py-4">
                <p className="text-red-400 text-sm mb-4">{errorMsg}</p>
                <button onClick={() => setPhase('form')} className="text-orange-600 hover:text-orange-400 text-sm font-bold">
                  Try again
                </button>
              </div>
            )}

            <div className="mt-6 pt-5 border-t border-zinc-800 flex justify-center gap-6">
              <span className="flex items-center gap-1.5 text-[10px] text-zinc-600 font-bold">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                Secure
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-zinc-600 font-bold">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                Private
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-zinc-600 font-bold">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                Free
              </span>
            </div>
          </div>

          <p className="text-zinc-700 text-xs text-center mt-6 font-medium">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="hover:text-zinc-500 transition-colors">Terms</Link>,{' '}
            <Link href="/privacy" className="hover:text-zinc-500 transition-colors">Privacy Policy</Link>, and{' '}
            <Link href="/ai-policy" className="hover:text-zinc-500 transition-colors">AI Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify it renders**

Run: `npm run dev` and visit `http://localhost:3000/signup`
Expected: Email-only signup form. Submitting sends a magic link email.

Also test: `http://localhost:3000/signup?intent=artist`
Expected: Subtitle says "Start selling your music." instead of the default.

- [ ] **Step 4: Commit**

```bash
git add app/signup/page.tsx app/signup/SignupClient.tsx
git commit -m "feat: unified signup page — email-only magic link"
```

---

## Task 5: Welcome Page — First Login Landing

**Files:**
- Create: `app/welcome/page.tsx`
- Create: `app/welcome/WelcomeClient.tsx`

Shown after first login. Two side-by-side CTAs: "Find music" and "Start selling." Marks `has_seen_welcome` in `fan_profiles` so returning users skip this page.

- [ ] **Step 1: Create the server component**

```typescript
// app/welcome/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth'
import { WelcomeClient } from './WelcomeClient'

export const metadata: Metadata = {
  title: 'Welcome to Insound',
}

export default async function WelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signup')

  const role = await getUserRole(supabase, user.id)

  // Already seen welcome and is an artist → dashboard
  if (role.hasSeenWelcome && role.isArtist) redirect('/dashboard')
  // Already seen welcome and is a fan → explore
  if (role.hasSeenWelcome) redirect('/explore')

  return <WelcomeClient />
}
```

- [ ] **Step 2: Create the client component**

```typescript
// app/welcome/WelcomeClient.tsx
'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export function WelcomeClient() {
  const supabase = createClient()

  async function markSeen() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('fan_profiles')
        .update({ has_seen_welcome: true })
        .eq('id', user.id)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(234,88,12,0.05),transparent_60%)]" />

      <div className="w-full max-w-2xl relative z-10 text-center">
        <p className="text-orange-600 font-black text-3xl tracking-tighter font-display mb-6">insound.</p>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[0.92] mb-4">
          Welcome to Insound.
        </h1>
        <p className="text-zinc-400 text-lg mb-16 max-w-md mx-auto">
          What brings you here?
        </p>

        <div className="grid sm:grid-cols-2 gap-4 max-w-lg mx-auto">
          <Link
            href="/explore"
            onClick={markSeen}
            className="bg-zinc-900 ring-1 ring-white/[0.06] rounded-3xl p-8 text-center hover:ring-white/[0.15] transition-all group"
          >
            <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-white/[0.04] flex items-center justify-center">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-zinc-400 group-hover:text-white transition-colors">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <p className="font-display font-bold text-lg mb-2 group-hover:text-white transition-colors">Find music to love</p>
            <p className="text-zinc-500 text-sm">Discover and support independent artists.</p>
          </Link>

          <Link
            href="/become-an-artist"
            onClick={markSeen}
            className="bg-orange-600/[0.06] ring-1 ring-orange-600/[0.15] rounded-3xl p-8 text-center hover:ring-orange-600/30 transition-all group"
          >
            <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-orange-600/10 flex items-center justify-center">
              <svg width="22" height="22" fill="none" stroke="#ea580c" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="font-display font-bold text-lg text-orange-400 mb-2 group-hover:text-orange-300 transition-colors">Start selling your music</p>
            <p className="text-zinc-500 text-sm">Upload, set your price, get paid direct.</p>
          </Link>
        </div>

        <p className="text-zinc-700 text-xs mt-10">You can always switch later from your profile menu.</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify it renders**

Run: Visit `http://localhost:3000/welcome` (must be logged in)
Expected: Two-CTA welcome screen. Clicking either marks welcome as seen and navigates.

- [ ] **Step 4: Commit**

```bash
git add app/welcome/page.tsx app/welcome/WelcomeClient.tsx
git commit -m "feat: welcome page — first-login intent selection"
```

---

## Task 6: Artist Upgrade Flow — `/become-an-artist`

**Files:**
- Create: `app/become-an-artist/page.tsx`
- Create: `app/become-an-artist/BecomeArtistClient.tsx`

Multi-step onboarding: artist name + slug, independence declaration, accent colour, optional bio/socials. On completion, inserts into `artists` and `artist_accounts` tables. Stripe Connect onboarding is deferred — they'll be prompted from the dashboard when they try to publish.

- [ ] **Step 1: Create the server component**

```typescript
// app/become-an-artist/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth'
import { BecomeArtistClient } from './BecomeArtistClient'

export const metadata: Metadata = {
  title: 'Become an Artist | Insound',
  description: 'Start selling your music on Insound.',
}

export default async function BecomeArtistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signup?intent=artist')

  const role = await getUserRole(supabase, user.id)
  if (role.isArtist) redirect('/dashboard')

  return <BecomeArtistClient userEmail={user.email ?? ''} />
}
```

- [ ] **Step 2: Create the client component**

```typescript
// app/become-an-artist/BecomeArtistClient.tsx
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const ACCENT_COLOURS = [
  '#ea580c', '#dc2626', '#db2777', '#9333ea', '#7c3aed',
  '#4f46e5', '#2563eb', '#0891b2', '#059669', '#16a34a',
  '#65a30d', '#ca8a04', '#d97706', '#78716c', '#ffffff',
]

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function BecomeArtistClient({ userEmail }: { userEmail: string }) {
  const router = useRouter()
  const supabase = createClient()

  // Step 1: Name + slug
  const [artistName, setArtistName] = useState('')
  const [slug, setSlug] = useState('')
  const slugTouched = useRef(false)

  // Step 2: Independence + terms
  const [attest, setAttest] = useState(false)
  const [terms, setTerms] = useState(false)

  // Step 3: Accent colour
  const [accent, setAccent] = useState('#ea580c')

  // Step 4: Bio (optional)
  const [bio, setBio] = useState('')

  // Form state
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function handleArtistNameChange(value: string) {
    setArtistName(value)
    if (!slugTouched.current) setSlug(slugify(value))
  }

  function handleSlugChange(value: string) {
    slugTouched.current = true
    setSlug(value)
  }

  async function handleComplete() {
    const trimmedSlug = slug.trim().toLowerCase()

    if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(trimmedSlug)) {
      setError('URL must be 3-40 characters: lowercase letters, numbers, hyphens.')
      setStep(1)
      return
    }
    if (!attest || !terms) {
      setError('Please confirm both checkboxes.')
      setStep(2)
      return
    }

    setBusy(true)
    setError('')

    try {
      // Check slug uniqueness
      const { data: existing } = await supabase
        .from('artists')
        .select('id')
        .eq('slug', trimmedSlug)
        .maybeSingle()

      if (existing) {
        setError(`"${trimmedSlug}" is already taken. Try another.`)
        setStep(1)
        setBusy(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Insert artist profile
      const { error: artistErr } = await supabase
        .from('artists')
        .insert({
          id: user.id,
          slug: trimmedSlug,
          name: artistName.trim(),
          bio: bio.trim() || null,
          accent_colour: accent,
        })
      if (artistErr) throw artistErr

      // Insert artist account
      const { error: accountErr } = await supabase
        .from('artist_accounts')
        .insert({
          id: user.id,
          email: userEmail,
          self_attest_independent: true,
          independence_confirmed: true,
          independence_confirmed_at: new Date().toISOString(),
        })
      if (accountErr) throw accountErr

      // Mark welcome as seen
      await supabase
        .from('fan_profiles')
        .update({ has_seen_welcome: true })
        .eq('id', user.id)

      router.push('/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setError(message)
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)', backgroundSize: '48px 48px' }}>
      <nav className="sticky top-0 w-full z-50 flex justify-between items-center px-6 md:px-14 py-5 border-b border-zinc-900/80" style={{ background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <Link href="/" className="text-2xl font-black text-orange-600 tracking-tighter hover:text-orange-500 transition-colors font-display">
          insound.
        </Link>
        <Link href="/explore" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
          Skip for now
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(234,88,12,0.05),transparent_60%)]" />

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-bold mb-2">Become an artist</h1>
            <p className="text-zinc-500 text-sm">Step {step} of 4</p>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1 mb-8">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-orange-600' : 'bg-zinc-800'}`} />
            ))}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl" style={{ boxShadow: '0 0 60px rgba(234,88,12,0.08)' }}>

            {error && (
              <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-3 mb-5">
                {error}
              </div>
            )}

            {/* Step 1: Name + Slug */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Artist Name</label>
                  <input
                    type="text"
                    placeholder="Band or stage name"
                    required
                    value={artistName}
                    onChange={e => handleArtistNameChange(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Your URL</label>
                  <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-4 focus-within:border-orange-600 transition-colors">
                    <span className="text-zinc-600 text-sm select-none">getinsound.com/</span>
                    <input
                      type="text"
                      placeholder="your-name"
                      required
                      value={slug}
                      onChange={e => handleSlugChange(e.target.value)}
                      className="flex-1 bg-transparent py-3.5 outline-none text-white text-sm placeholder-zinc-700"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1.5">Lowercase letters, numbers and hyphens only.</p>
                </div>
                <button
                  onClick={() => {
                    if (!artistName.trim()) { setError('Artist name is required.'); return }
                    setError('')
                    setStep(2)
                  }}
                  className="w-full bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider"
                >
                  Continue →
                </button>
              </div>
            )}

            {/* Step 2: Independence + Terms */}
            {step === 2 && (
              <div className="space-y-5">
                <p className="text-zinc-400 text-sm leading-relaxed mb-2">
                  Insound is exclusively for independent and unsigned artists. Please confirm the following:
                </p>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={attest}
                    onChange={e => setAttest(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-700 bg-zinc-950 text-orange-600 focus:ring-orange-600 focus:ring-offset-0"
                  />
                  <span className="text-xs text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">
                    I confirm that I am an <strong className="text-white">independent, unsigned artist</strong> and am not signing up on behalf of a record label, management company, or any entity with a commercial music distribution agreement.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={e => setTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-700 bg-zinc-950 text-orange-600 focus:ring-orange-600 focus:ring-offset-0"
                  />
                  <span className="text-xs text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">
                    I agree to the <Link href="/terms" className="text-orange-600 hover:text-orange-400">Terms of Service</Link>, <Link href="/privacy" className="text-orange-600 hover:text-orange-400">Privacy Policy</Link>, and <Link href="/ai-policy" className="text-orange-600 hover:text-orange-400">AI Content Policy</Link>.
                  </span>
                </label>
                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex-1 bg-zinc-800 text-white font-bold py-4 rounded-xl hover:bg-zinc-700 transition-colors text-sm">
                    ← Back
                  </button>
                  <button
                    onClick={() => {
                      if (!attest || !terms) { setError('Please confirm both checkboxes.'); return }
                      setError('')
                      setStep(3)
                    }}
                    className="flex-1 bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Accent Colour */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-4">Choose your accent colour</label>
                  <div className="grid grid-cols-5 gap-3">
                    {ACCENT_COLOURS.map(c => (
                      <button
                        key={c}
                        onClick={() => setAccent(c)}
                        className={`w-full aspect-square rounded-xl transition-all ${accent === c ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110' : 'hover:scale-105'}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="flex-1 bg-zinc-800 text-white font-bold py-4 rounded-xl hover:bg-zinc-700 transition-colors text-sm">
                    ← Back
                  </button>
                  <button onClick={() => setStep(4)} className="flex-1 bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider">
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Bio (optional) */}
            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Bio <span className="text-zinc-700">(optional)</span></label>
                  <textarea
                    placeholder="Tell fans about yourself..."
                    rows={4}
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600 resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(3)} className="flex-1 bg-zinc-800 text-white font-bold py-4 rounded-xl hover:bg-zinc-700 transition-colors text-sm">
                    ← Back
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={busy}
                    className="flex-1 bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {busy ? 'Setting up...' : 'Complete setup →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify the flow**

Run: Visit `http://localhost:3000/become-an-artist` (must be logged in as a non-artist user)
Expected: 4-step wizard. On completion, rows are inserted into `artists` + `artist_accounts`, and user is redirected to `/dashboard`.

- [ ] **Step 4: Commit**

```bash
git add app/become-an-artist/page.tsx app/become-an-artist/BecomeArtistClient.tsx
git commit -m "feat: artist upgrade flow — 4-step onboarding at /become-an-artist"
```

---

## Task 7: Update Middleware — Route Protection + Welcome Redirect

**Files:**
- Modify: `middleware.ts`

Add route protection: artist-only routes (`/dashboard`, `/release`) redirect non-artists to `/become-an-artist`. Authenticated users who haven't seen welcome get redirected to `/welcome` (except on excluded paths).

- [ ] **Step 1: Rewrite middleware**

Replace the entire contents of `middleware.ts`:

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ARTIST_ROUTES = ['/dashboard', '/release']
const PUBLIC_ROUTES = ['/', '/auth', '/signup', '/explore', '/why-us', '/for-artists', '/for-fans', '/for-press', '/privacy', '/terms', '/ai-policy']
const AUTH_EXCLUDED = ['/auth', '/signup', '/auth/callback', '/welcome', '/become-an-artist', '/api']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Protect artist-only routes
  if (user && ARTIST_ROUTES.some(r => path.startsWith(r))) {
    const { data: artist } = await supabase
      .from('artists')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!artist) {
      const url = request.nextUrl.clone()
      url.pathname = '/become-an-artist'
      return NextResponse.redirect(url)
    }
  }

  // Redirect unauthenticated users away from protected routes
  if (!user && !PUBLIC_ROUTES.some(r => path === r) && !AUTH_EXCLUDED.some(r => path.startsWith(r))) {
    const url = request.nextUrl.clone()
    url.pathname = '/signup'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|zip|pdf)$).*)',
  ],
}
```

- [ ] **Step 2: Verify route protection**

Test the following scenarios:
1. Unauthenticated → `/dashboard` → redirected to `/signup`
2. Authenticated non-artist → `/dashboard` → redirected to `/become-an-artist`
3. Authenticated artist → `/dashboard` → renders normally
4. Unauthenticated → `/explore` → renders normally (public route)

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: middleware route protection — artist gates + public routes"
```

---

## Task 8: Update Auth Page — Keep Sign-In, Remove Signup Tab

**Files:**
- Modify: `app/auth/AuthClient.tsx`
- Modify: `app/auth/page.tsx`

The `/auth` page becomes sign-in only (for existing password-based users). The "Create Account" tab is replaced with a link to `/signup`. Add a magic link option alongside password login.

- [ ] **Step 1: Update the page metadata**

In `app/auth/page.tsx`, change the metadata title:

Replace:
```typescript
export const metadata = { title: 'Sign In | Insound' }
```

The current `page.tsx` file has no explicit metadata — add it. Replace the entire file:

```typescript
// app/auth/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthClient from './AuthClient'

export const metadata: Metadata = {
  title: 'Sign In | Insound',
}

export default async function AuthPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/welcome')

  return <AuthClient />
}
```

- [ ] **Step 2: Rewrite AuthClient — sign-in only**

Replace the entire contents of `app/auth/AuthClient.tsx`:

```typescript
// app/auth/AuthClient.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function AuthClient() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<'password' | 'magic'>('magic')

  // Password login
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Magic link
  const [magicEmail, setMagicEmail] = useState('')
  const [magicSent, setMagicSent] = useState(false)
  const [magicBusy, setMagicBusy] = useState(false)
  const [magicError, setMagicError] = useState('')

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error
      router.push('/welcome')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.')
      setBusy(false)
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setMagicError('')
    setMagicBusy(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: magicEmail.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/welcome`,
      },
    })
    if (error) {
      setMagicError(error.message)
    } else {
      setMagicSent(true)
    }
    setMagicBusy(false)
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)', backgroundSize: '48px 48px' }}>
      <nav className="sticky top-0 w-full z-50 flex justify-between items-center px-6 md:px-14 py-5 border-b border-zinc-900/80" style={{ background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <Link href="/" className="text-2xl font-black text-orange-600 tracking-tighter hover:text-orange-500 transition-colors font-display">
          insound.
        </Link>
        <Link href="/signup" className="bg-orange-600 text-black px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition-colors shadow-lg shadow-orange-600/20">
          Create Account
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(234,88,12,0.05),transparent_60%)]" />

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <Link href="/" className="text-3xl font-black text-orange-600 tracking-tighter hover:text-orange-500 transition-colors font-display">
              insound.
            </Link>
            <p className="text-zinc-500 mt-2 font-medium text-sm">Welcome back.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl" style={{ boxShadow: '0 0 60px rgba(234,88,12,0.08)' }}>
            {/* Mode tabs */}
            <div className="flex gap-1 mb-8 bg-zinc-950 p-1 rounded-xl">
              <button
                onClick={() => setMode('magic')}
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${mode === 'magic' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Magic Link
              </button>
              <button
                onClick={() => setMode('password')}
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${mode === 'password' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Password
              </button>
            </div>

            {/* Magic link form */}
            {mode === 'magic' && !magicSent && (
              <form onSubmit={handleMagicLink} className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Email Address</label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    required
                    autoComplete="email"
                    value={magicEmail}
                    onChange={e => setMagicEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={magicBusy}
                  className="w-full bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {magicBusy ? 'Sending...' : 'Send magic link →'}
                </button>
                {magicError && (
                  <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-3">
                    {magicError}
                  </div>
                )}
              </form>
            )}

            {mode === 'magic' && magicSent && (
              <div className="text-center py-4">
                <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-orange-600/15 border border-orange-600/40 flex items-center justify-center">
                  <svg width="24" height="24" fill="none" stroke="#ea580c" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-black text-white mb-2 font-display">Check your inbox</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  We sent a magic link to <span className="text-white font-semibold">{magicEmail.trim()}</span>.
                </p>
              </div>
            )}

            {/* Password form */}
            {mode === 'password' && (
              <form onSubmit={handlePasswordLogin} className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Email Address</label>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600"
                  />
                </div>
                <div className="relative">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm pr-12 focus:border-orange-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-4 top-[38px] text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      {showPw ? (
                        <>
                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </>
                      ) : (
                        <>
                          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {busy ? 'Signing in...' : 'Sign In'}
                </button>
                {error && (
                  <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-3">
                    {error}
                  </div>
                )}
              </form>
            )}

            <div className="mt-6 pt-5 border-t border-zinc-800 text-center">
              <p className="text-zinc-600 text-xs">
                Don&apos;t have an account? <Link href="/signup" className="text-orange-600 hover:text-orange-400 font-bold">Sign up</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify sign-in page**

Run: Visit `http://localhost:3000/auth`
Expected: Sign-in page with Magic Link / Password tabs. No signup form. "Create Account" button in nav links to `/signup`.

- [ ] **Step 4: Commit**

```bash
git add app/auth/page.tsx app/auth/AuthClient.tsx
git commit -m "feat: rewrite auth page — sign-in only with magic link + password"
```

---

## Task 9: Update CTAs Across the Site

**Files:**
- Modify: `app/for-artists/ForArtistsClient.tsx`
- Modify: `app/components/HomeClient.tsx`

Update links from `/auth` to `/signup` and change the for-artists CTA from a waitlist form to a signup link.

- [ ] **Step 1: Update for-artists CTA**

In `app/for-artists/ForArtistsClient.tsx`, replace the waitlist form section (the CTA section, lines ~296-329) with a signup link:

Find the `{/* ── CTA ── */}` section and replace the waitlist form with:

```typescript
          {phase === 'form' ? (
            <Link href="/signup?intent=artist"
              className="inline-block bg-orange-600 hover:bg-orange-500 text-black font-bold text-sm px-8 py-4 rounded-2xl transition-colors shadow-xl shadow-orange-600/25">
              Start selling your music →
            </Link>
          ) : (
```

Also remove the email state, sending state, invalid state, inputRef, submit function, and the SB_URL/SB_KEY constants from the top of the component — they're no longer needed. Keep the `isValidEmail` function only if used elsewhere in the file (it isn't — remove it too).

The cleaned-up CTA section becomes:

```tsx
      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 bg-orange-600/10 ring-1 ring-orange-600/20 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-10">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 pulse-dot" />
            Now open
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.04em] leading-[0.9] mb-6">
            Your music.<br />Your money.
          </h2>
          <p className="text-zinc-400 text-sm max-w-sm mx-auto mb-10 leading-relaxed">
            Sign up and start selling. We only take 10%. Every fee shown upfront.
          </p>
          <Link href="/signup?intent=artist"
            className="inline-block bg-orange-600 hover:bg-orange-500 text-black font-bold text-sm px-8 py-4 rounded-2xl transition-colors shadow-xl shadow-orange-600/25">
            Start selling your music →
          </Link>
        </div>
      </section>
```

Remove the unused state variables, refs, and functions from the top of the component: `email`, `sending`, `phase`, `invalid`, `inputRef`, `submit()`, `SB_URL`, `SB_KEY`, `isValidEmail`. Also remove the `useState` and `useRef` imports if no longer used (check — `FaqAccordion` uses both, so keep them).

- [ ] **Step 2: Update HomeClient nav CTA**

In `app/components/HomeClient.tsx`, the nav's "Join the waitlist" button links to `#top`. The "Get Started" intent should point to `/signup`. Find the nav CTA button (line ~334):

```tsx
            <a href="#top" onClick={scrollAndPop}
              className="bg-orange-600 hover:bg-orange-500 ...">
              Join the waitlist
            </a>
```

Replace with:
```tsx
            <Link href="/signup"
              className="bg-orange-600 hover:bg-orange-500 text-black text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-full transition-colors shadow-lg shadow-orange-600/20">
              Get started
            </Link>
```

Note: The waitlist forms in the hero and bottom CTA sections can remain for now — they serve the waitlist use case which is still live. The nav CTA is what changes to point to the new signup flow.

- [ ] **Step 3: Update dashboard redirect**

In `app/dashboard/page.tsx`, change the auth redirect (line 11):

From: `if (!user) redirect('/auth')`
To: `if (!user) redirect('/signup')`

And line 37:
From: `if (!artist || !account) redirect('/auth')`
To: `if (!artist || !account) redirect('/become-an-artist')`

- [ ] **Step 4: Verify changes**

Run: Visit `/for-artists` — CTA should be a "Start selling" link to `/signup?intent=artist`
Run: Visit `/` — nav should show "Get started" linking to `/signup`
Run: Visit `/dashboard` unauthenticated — should redirect to `/signup`

- [ ] **Step 5: Commit**

```bash
git add app/for-artists/ForArtistsClient.tsx app/components/HomeClient.tsx app/dashboard/page.tsx
git commit -m "feat: update CTAs to use unified signup flow"
```

---

## Task 10: Build Verification

- [ ] **Step 1: Run the build**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 2: Manual smoke test**

Test the full flow:
1. `/signup` → enter email → magic link sent
2. Click magic link → `/auth/callback` → redirected to `/welcome`
3. `/welcome` → click "Start selling" → `/become-an-artist`
4. Complete 4-step wizard → redirected to `/dashboard`
5. `/auth` → sign in with password → redirected to `/welcome` → auto-redirected (already seen) to `/dashboard` or `/explore`
6. `/signup?intent=artist` → magic link → auto-redirected to `/become-an-artist`

- [ ] **Step 3: Commit any fixes**

If any fixes were needed during smoke testing, commit them.

---

## Notes

**What this plan does NOT include (intentional):**
- **Stripe Connect onboarding** — deferred. Artists will be prompted from the dashboard when they try to publish a release. This keeps the upgrade flow fast.
- **Profile menu "Start selling" CTA** — the profile menu doesn't exist yet in the codebase. When it's built, it should check `getUserRole()` and show "Start selling on Insound" for non-artists.
- **Existing user migration** — the current waitlist is pre-launch. There are no existing password-based users to migrate. The old password login is preserved at `/auth` for any early testers.
- **Default currency selection** — the `default_currency` column is added to `artists` but defaults to GBP. A currency picker can be added to the upgrade flow later.
- **`fan_profiles` backfill** — existing users (if any) who signed up before this migration won't have a `fan_profiles` row. The `getUserRole` helper handles this gracefully (returns `hasSeenWelcome: false`). The welcome page's server component should work regardless.
