# Public Fan Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build public fan profiles — a fan's music library as a curated, public-facing shelf at `/[username]`, with bento grid layout, pinned Top 3, vinyl shelf with hover tilt, artist post wall, badge system, and privacy controls.

**Architecture:** Fan profiles reuse the existing `[slug]` catch-all route — after checking for artist slugs, the route checks `fan_profiles.username`. The profile page is SSR (server component fetches data, client component renders the bento layout). Privacy is enforced via RLS policies: profiles default to private, purchases of public fans are readable by anyone (excluding hidden purchases). Artist posts are stored in a new `artist_posts` table and displayed as a filtered feed. Badges are awarded via DB triggers and app-level logic.

**Tech Stack:** Next.js 15 App Router, Supabase PostgreSQL + RLS + Storage, TypeScript, Tailwind CSS, Zustand (player store), HTML5 Drag and Drop

---

## File Structure

### New files
- `supabase/migrations/0012_fan_profiles_public.sql` — tables, RLS, storage bucket
- `app/[slug]/FanProfileClient.tsx` — full fan profile page (bento layout, all modules)
- `app/settings/profile/page.tsx` — server component for fan settings
- `app/settings/profile/ProfileSettingsClient.tsx` — profile editing + privacy controls

### Modified files
- `app/[slug]/page.tsx` — dual resolution: artist slug → fan username fallback
- `middleware.ts` — add `/settings` as a known route

### Existing files (reference only, do not modify)
- `lib/accent.ts` — `resolveAccent()`, `DEFAULT_ACCENT` — reuse for fan accent colours
- `lib/stores/player.ts` — `usePlayerStore`, `Track` interface — reuse for click-to-play
- `lib/supabase/server.ts` / `lib/supabase/client.ts` — Supabase client factories

---

## Task 1: Schema Migration

**Files:**
- Create: `supabase/migrations/0012_fan_profiles_public.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0012_fan_profiles_public.sql
-- Public fan profiles: pinned releases, hidden purchases, artist posts,
-- fan badges, RLS for public viewing, avatar storage.

-- ============================================================
-- 1. FAN PROFILES: fix default + constraints
-- ============================================================

-- Default private until fan opts in (spec overrides 0011's default true)
alter table public.fan_profiles alter column is_public set default false;
update public.fan_profiles set is_public = false;

-- Username uniqueness + format validation
create unique index if not exists fan_profiles_username_unique
  on public.fan_profiles (username) where username is not null;

alter table public.fan_profiles
  add constraint fan_profiles_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$');

-- ============================================================
-- 2. FAN PINNED RELEASES
-- ============================================================

create table public.fan_pinned_releases (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  release_id uuid not null references public.releases(id) on delete cascade,
  position   integer not null check (position >= 1 and position <= 3),
  created_at timestamptz not null default now(),
  unique (user_id, position),
  unique (user_id, release_id)
);

create index fan_pinned_user_idx on public.fan_pinned_releases(user_id);

alter table public.fan_pinned_releases enable row level security;

create policy fan_pinned_select_own on public.fan_pinned_releases
  for select using ((select auth.uid()) = user_id);
create policy fan_pinned_insert_own on public.fan_pinned_releases
  for insert with check ((select auth.uid()) = user_id);
create policy fan_pinned_update_own on public.fan_pinned_releases
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy fan_pinned_delete_own on public.fan_pinned_releases
  for delete using ((select auth.uid()) = user_id);
create policy fan_pinned_read_public on public.fan_pinned_releases
  for select using (
    exists (select 1 from public.fan_profiles fp
            where fp.id = fan_pinned_releases.user_id and fp.is_public = true)
  );

-- ============================================================
-- 3. FAN HIDDEN PURCHASES
-- ============================================================

create table public.fan_hidden_purchases (
  user_id     uuid not null references auth.users(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, purchase_id)
);

alter table public.fan_hidden_purchases enable row level security;

create policy fan_hidden_select_own on public.fan_hidden_purchases
  for select using ((select auth.uid()) = user_id);
create policy fan_hidden_insert_own on public.fan_hidden_purchases
  for insert with check ((select auth.uid()) = user_id);
create policy fan_hidden_delete_own on public.fan_hidden_purchases
  for delete using ((select auth.uid()) = user_id);

-- ============================================================
-- 4. FAN BADGES
-- ============================================================

create table public.fan_badges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  badge_type text not null check (badge_type in ('founding_fan', 'limited_edition', 'early_supporter')),
  release_id uuid references public.releases(id) on delete set null,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_type, release_id)
);

create index fan_badges_user_idx on public.fan_badges(user_id);

alter table public.fan_badges enable row level security;

-- Badges are public on public profiles
create policy fan_badges_select_own on public.fan_badges
  for select using ((select auth.uid()) = user_id);
create policy fan_badges_read_public on public.fan_badges
  for select using (
    exists (select 1 from public.fan_profiles fp
            where fp.id = fan_badges.user_id and fp.is_public = true)
  );
-- Only service_role inserts badges (via triggers/functions)

-- ============================================================
-- 5. ARTIST POSTS (The Wall)
-- ============================================================

create table public.artist_posts (
  id         uuid primary key default gen_random_uuid(),
  artist_id  uuid not null references public.artists(id) on delete cascade,
  post_type  text not null check (post_type in ('text', 'photo', 'demo', 'voice_note')),
  content    text not null,
  media_url  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index artist_posts_artist_idx on public.artist_posts(artist_id);
create index artist_posts_created_idx on public.artist_posts(created_at desc);

create trigger set_updated_at before update on public.artist_posts
  for each row execute function public.tg_set_updated_at();

alter table public.artist_posts enable row level security;

-- Public read (anyone can see posts from artists they follow/purchased from)
create policy artist_posts_read_all on public.artist_posts
  for select using (true);
-- Artist can CRUD their own posts
create policy artist_posts_insert_own on public.artist_posts
  for insert with check ((select auth.uid()) = artist_id);
create policy artist_posts_update_own on public.artist_posts
  for update using ((select auth.uid()) = artist_id)
  with check ((select auth.uid()) = artist_id);
create policy artist_posts_delete_own on public.artist_posts
  for delete using ((select auth.uid()) = artist_id);

-- ============================================================
-- 6. RLS POLICIES FOR PUBLIC FAN PROFILES
-- ============================================================

-- Anyone can read public fan profiles
create policy fan_profiles_read_public on public.fan_profiles
  for select using (is_public = true);

-- Buyer can read their own purchases (not just artist)
create policy purchases_read_buyer on public.purchases
  for select using ((select auth.uid()) = buyer_user_id);

-- Purchases of public fans are readable (excluding hidden)
create policy purchases_read_public_fan on public.purchases
  for select using (
    exists (
      select 1 from public.fan_profiles fp
      where fp.id = purchases.buyer_user_id and fp.is_public = true
    )
    and not exists (
      select 1 from public.fan_hidden_purchases fhp
      where fhp.user_id = purchases.buyer_user_id
        and fhp.purchase_id = purchases.id
    )
  );

-- ============================================================
-- 7. STORAGE: fan avatars + artist post media
-- ============================================================

insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('post-media', 'post-media', true)
on conflict (id) do nothing;

-- Avatars: public read, owner writes to own folder
create policy avatars_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');
create policy avatars_write_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Post media: public read, artist writes to own folder
create policy post_media_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'post-media');
create policy post_media_write_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- ============================================================
-- 8. BADGE AWARDING: founding_fan for first 1000 waitlist signups
-- ============================================================

-- Award founding_fan badge to existing waitlist users (first 1000)
-- This runs once at migration time. The artist_accounts table tracks
-- early signups. We award to all users who have a fan_profiles row.
-- Future badge awarding happens at the application level.

insert into public.fan_badges (user_id, badge_type)
select fp.id, 'founding_fan'
from public.fan_profiles fp
where not exists (
  select 1 from public.fan_badges fb
  where fb.user_id = fp.id and fb.badge_type = 'founding_fan'
)
order by fp.created_at asc
limit 1000;
```

- [ ] **Step 2: Verify the migration syntax**

Read the file back and check for SQL syntax issues. Ensure all foreign key references point to existing tables and all constraint names are unique.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0012_fan_profiles_public.sql
git commit -m "feat: schema for public fan profiles — pinned releases, badges, artist posts, RLS"
```

---

## Task 2: Update [slug] Route — Dual Resolution

**Files:**
- Modify: `app/[slug]/page.tsx`

The existing route resolves artist slugs. We extend it to also resolve fan usernames. Artist slugs take priority. Add missing routes to STATIC_ROUTES to prevent unnecessary DB queries.

- [ ] **Step 1: Rewrite page.tsx for dual resolution**

Replace the entire contents of `app/[slug]/page.tsx`:

```typescript
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ArtistProfileClient from './ArtistProfileClient'
import { FanProfileClient } from './FanProfileClient'
export const runtime = 'edge'

interface Props {
  params: Promise<{ slug: string }>
}

const STATIC_ROUTES = new Set([
  'ai-policy', 'api', 'auth', 'become-an-artist', 'components', 'dashboard',
  'discography', 'download', 'explore', 'for-artists', 'for-fans', 'for-press',
  'library', 'player', 'privacy', 'release', 'sales', 'settings', 'signup',
  'terms', 'welcome', 'why-us',
  '_not-found', '_document', '_app', '_error',
])

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (STATIC_ROUTES.has(slug)) return {}

  const supabase = await createClient()

  const [{ data: artist }, { data: fan }] = await Promise.all([
    supabase.from('artists').select('name, bio').eq('slug', slug).maybeSingle(),
    supabase.from('fan_profiles').select('username, bio').eq('username', slug).maybeSingle(),
  ])

  if (artist) {
    const title = `${artist.name} | insound.`
    const description = artist.bio || `Listen to ${artist.name} on Insound. Buy music directly from the artist.`
    return { title, description, openGraph: { title, description, type: 'profile' } }
  }

  if (fan) {
    const title = `${fan.username} | insound.`
    const description = fan.bio || `${fan.username}'s music collection on Insound.`
    return { title, description, openGraph: { title, description, type: 'profile' } }
  }

  return {}
}

export default async function ProfilePage({ params }: Props) {
  const { slug } = await params
  if (STATIC_ROUTES.has(slug)) notFound()

  const supabase = await createClient()

  // Resolve: try artist and fan in parallel (artist takes priority)
  const [{ data: artist }, { data: fan }] = await Promise.all([
    supabase.from('artists')
      .select('id, slug, name, bio, avatar_url, accent_colour')
      .eq('slug', slug).maybeSingle(),
    supabase.from('fan_profiles')
      .select('id, username, avatar_url, bio, accent_colour, is_public, show_purchase_amounts, created_at')
      .eq('username', slug).maybeSingle(),
  ])

  // ── Artist profile ────────────────────────────────────────────
  if (artist) {
    const { data: releases } = await supabase
      .from('releases')
      .select('id, slug, title, type, cover_url, price_pence, published, pwyw_enabled, pwyw_minimum_pence, preorder_enabled, release_date, tracks(id, title, position, duration_sec)')
      .eq('artist_id', artist.id)
      .eq('published', true)
      .order('created_at', { ascending: false })

    return (
      <ArtistProfileClient
        artist={artist}
        releases={(releases || []).map(r => ({
          ...r,
          tracks: [...(r.tracks || [])].sort((a, b) => a.position - b.position),
        }))}
      />
    )
  }

  // ── Fan profile ───────────────────────────────────────────────
  if (!fan) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const isOwner = user?.id === fan.id

  const [purchasesRes, pinnedRes, badgesRes, prefsRes] = await Promise.all([
    supabase.from('purchases')
      .select('id, amount_pence, paid_at, releases (id, slug, title, type, cover_url, price_pence), artists (slug, name, accent_colour)')
      .eq('buyer_user_id', fan.id)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false }),
    supabase.from('fan_pinned_releases')
      .select('position, release_id, releases (id, slug, title, type, cover_url, price_pence, artists (slug, name, accent_colour))')
      .eq('user_id', fan.id)
      .order('position', { ascending: true }),
    supabase.from('fan_badges')
      .select('badge_type, release_id, awarded_at')
      .eq('user_id', fan.id),
    supabase.from('fan_preferences')
      .select('genre')
      .eq('user_id', fan.id)
      .limit(1),
  ])

  const purchases = purchasesRes.data || []
  const pinned = pinnedRes.data || []
  const badges = badgesRes.data || []
  const favouriteGenre = prefsRes.data?.[0]?.genre ?? null

  // Fetch artist posts from artists this fan has purchased from
  const purchasedArtistIds = [...new Set(purchases.map(p => (p.artists as { slug: string }).slug ? undefined : undefined).filter(Boolean))]
  // Simpler: extract unique artist IDs from purchases
  const artistIdSet = new Set<string>()
  for (const p of purchases) {
    // purchases.artists is the joined artist object — we need the artist ID
    // Since purchases table has artist_id column, we need it in the select
  }

  // Re-query purchases to get artist_id for Wall filtering
  // (artist_id is on the purchases table directly)
  const { data: purchaseArtistIds } = await supabase
    .from('purchases')
    .select('artist_id')
    .eq('buyer_user_id', fan.id)
    .eq('status', 'paid')

  const uniqueArtistIds = [...new Set((purchaseArtistIds || []).map(p => p.artist_id))]

  // Fetch artist posts for The Wall
  let wallPosts: Array<{
    id: string
    artist_id: string
    post_type: string
    content: string
    media_url: string | null
    created_at: string
    artists: { slug: string; name: string; accent_colour: string | null; avatar_url: string | null }
  }> = []

  if (uniqueArtistIds.length > 0) {
    const { data: posts } = await supabase
      .from('artist_posts')
      .select('id, artist_id, post_type, content, media_url, created_at, artists (slug, name, accent_colour, avatar_url)')
      .in('artist_id', uniqueArtistIds)
      .order('created_at', { ascending: false })
      .limit(20)

    wallPosts = (posts || []) as typeof wallPosts
  }

  // Compute stats
  const artistCounts: Record<string, { name: string; count: number }> = {}
  for (const p of purchases) {
    const a = p.artists as { slug: string; name: string; accent_colour: string | null }
    if (!artistCounts[a.slug]) artistCounts[a.slug] = { name: a.name, count: 0 }
    artistCounts[a.slug].count++
  }
  const mostSupportedArtist = Object.values(artistCounts).sort((a, b) => b.count - a.count)[0] ?? null
  const uniqueArtistSlugs = new Set(Object.keys(artistCounts))
  const sortedByDate = [...purchases].filter(p => p.paid_at).sort((a, b) =>
    new Date(a.paid_at).getTime() - new Date(b.paid_at).getTime()
  )
  const supporterSince = sortedByDate.length > 0 ? new Date(sortedByDate[0].paid_at).getFullYear() : null

  return (
    <FanProfileClient
      fan={fan}
      purchases={purchases as any}
      pinned={pinned as any}
      badges={badges}
      wallPosts={wallPosts}
      stats={{
        supporterSince,
        totalArtists: uniqueArtistSlugs.size,
        totalReleases: purchases.length,
        mostSupportedArtist,
      }}
      favouriteGenre={favouriteGenre}
      isOwner={isOwner}
    />
  )
}
```

- [ ] **Step 2: Verify the route resolves both artists and fans**

Run: `npm run dev` and visit:
- `http://localhost:3000/<existing-artist-slug>` — should render artist profile
- `http://localhost:3000/signup` — should render signup page (not try to resolve as profile)
- `http://localhost:3000/nonexistent` — should 404

- [ ] **Step 3: Commit**

```bash
git add app/[slug]/page.tsx
git commit -m "feat: dual slug resolution — artist profiles + fan profiles at /[slug]"
```

---

## Task 3: FanProfileClient — Full Bento Profile Page

**Files:**
- Create: `app/[slug]/FanProfileClient.tsx`

The main fan profile client component. Renders a bento grid layout with: Profile Header, Supporter Stats Sidebar, Top 3 Shelf, Digital Vinyl Shelf (with hover tilt), The Wall (artist post feed), and badge display. Uses the fan's accent colour throughout.

- [ ] **Step 1: Create the FanProfileClient component**

```typescript
'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { resolveAccent } from '@/lib/accent'
import { createClient } from '@/lib/supabase/client'

/* ── Types ────────────────────────────────────────────────────── */

interface FanRelease {
  id: string
  slug: string
  title: string
  type: string
  cover_url: string | null
  price_pence: number
}

interface FanArtist {
  slug: string
  name: string
  accent_colour: string | null
}

interface FanPurchase {
  id: string
  amount_pence: number
  paid_at: string
  releases: FanRelease
  artists: FanArtist
}

interface FanPinned {
  position: number
  release_id: string
  releases: FanRelease & { artists: FanArtist }
}

interface FanBadge {
  badge_type: string
  release_id: string | null
  awarded_at: string
}

interface WallPost {
  id: string
  artist_id: string
  post_type: string
  content: string
  media_url: string | null
  created_at: string
  artists: { slug: string; name: string; accent_colour: string | null; avatar_url: string | null }
}

interface FanStats {
  supporterSince: number | null
  totalArtists: number
  totalReleases: number
  mostSupportedArtist: { name: string; count: number } | null
}

interface FanProfile {
  id: string
  username: string
  avatar_url: string | null
  bio: string | null
  accent_colour: string | null
  is_public: boolean
  show_purchase_amounts: boolean
  created_at: string
}

interface Props {
  fan: FanProfile
  purchases: FanPurchase[]
  pinned: FanPinned[]
  badges: FanBadge[]
  wallPosts: WallPost[]
  stats: FanStats
  favouriteGenre: string | null
  isOwner: boolean
}

/* ── Badge helpers ────────────────────────────────────────────── */

const BADGE_META: Record<string, { label: string; icon: string }> = {
  founding_fan: { label: 'Founding Fan', icon: '⭐' },
  limited_edition: { label: 'Limited Edition', icon: '💎' },
  early_supporter: { label: 'Early Supporter', icon: '🎵' },
}

function badgeLabel(type: string): string {
  return BADGE_META[type]?.label ?? type
}

function badgeIcon(type: string): string {
  return BADGE_META[type]?.icon ?? '🏷'
}

/* ── Time helpers ─────────────────────────────────────────────── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

/* ── Component ────────────────────────────────────────────────── */

export function FanProfileClient({ fan, purchases, pinned, badges, wallPosts, stats, favouriteGenre, isOwner }: Props) {
  const accent = resolveAccent(fan.accent_colour)
  const supabase = createClient()

  // Edit mode state for pinning
  const [editing, setEditing] = useState(false)
  const [localPinned, setLocalPinned] = useState<FanPinned[]>(pinned)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  // ── Pin / Unpin ────────────────────────────────────────────
  const togglePin = useCallback(async (releaseId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const existingIdx = localPinned.findIndex(p => p.release_id === releaseId)

    if (existingIdx >= 0) {
      await supabase.from('fan_pinned_releases')
        .delete().eq('user_id', user.id).eq('release_id', releaseId)
      setLocalPinned(prev => prev.filter(p => p.release_id !== releaseId))
    } else {
      if (localPinned.length >= 3) return
      const usedPositions = new Set(localPinned.map(p => p.position))
      const nextPos = [1, 2, 3].find(p => !usedPositions.has(p))!

      await supabase.from('fan_pinned_releases')
        .insert({ user_id: user.id, release_id: releaseId, position: nextPos })

      const purchase = purchases.find(p => p.releases.id === releaseId)
      if (purchase) {
        setLocalPinned(prev => [...prev, {
          position: nextPos,
          release_id: releaseId,
          releases: { ...purchase.releases, artists: purchase.artists },
        }].sort((a, b) => a.position - b.position))
      }
    }
  }, [localPinned, purchases, supabase])

  // ── Drag to reorder Top 3 ──────────────────────────────────
  function handleDragStart(e: React.DragEvent, index: number) {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === dropIndex) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const newPinned = [...localPinned]
    const [moved] = newPinned.splice(dragIndex, 1)
    newPinned.splice(dropIndex, 0, moved)
    const updated = newPinned.map((pin, i) => ({ ...pin, position: i + 1 }))
    setLocalPinned(updated)

    for (const pin of updated) {
      await supabase.from('fan_pinned_releases')
        .update({ position: pin.position })
        .eq('user_id', user.id)
        .eq('release_id', pin.release_id)
    }
    setDragIndex(null)
  }

  // ── Badge lookup for a release ─────────────────────────────
  function getBadgesForRelease(releaseId: string): FanBadge[] {
    return badges.filter(b => b.release_id === releaseId)
  }

  const globalBadges = badges.filter(b => !b.release_id)

  return (
    <main className="bg-[#0A0A0A] text-white min-h-screen">
      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-4 mt-4 px-5 py-3 rounded-2xl ring-1 ring-white/[0.05] flex items-center justify-between"
          style={{ background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          <Link href="/" className="font-display text-lg font-bold">
            insound<span style={{ color: accent }}>.</span>
          </Link>
          <div className="flex items-center gap-3">
            {isOwner && (
              <>
                <Link href="/settings/profile"
                  className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
                  Settings
                </Link>
                <button
                  onClick={() => setEditing(!editing)}
                  className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full transition-colors"
                  style={editing
                    ? { background: accent, color: '#000' }
                    : { color: accent, border: `1px solid ${accent}33` }
                  }
                >
                  {editing ? 'Done' : 'Edit'}
                </button>
              </>
            )}
            {!isOwner && (
              <Link href="/explore"
                className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
                Explore
              </Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-32 pb-24">
        {/* ── Bento Grid ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Profile Header (2 cols) ──────────────────────── */}
          <div className="lg:col-span-2 bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl p-8">
            <div className="flex items-start gap-6">
              {fan.avatar_url ? (
                <Image src={fan.avatar_url} alt={fan.username} width={80} height={80}
                  className="rounded-full object-cover w-20 h-20 shrink-0" />
              ) : (
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
                  style={{ background: `${accent}22`, color: accent }}>
                  {fan.username[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-bold truncate">{fan.username}</h1>
                {fan.bio && (
                  <p className="text-zinc-400 text-sm mt-1 leading-relaxed line-clamp-3">{fan.bio}</p>
                )}
                {/* Badges */}
                {globalBadges.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {globalBadges.map(b => (
                      <span key={`${b.badge_type}-${b.release_id}`}
                        className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full"
                        style={{ background: `${accent}15`, color: accent }}>
                        {badgeIcon(b.badge_type)} {badgeLabel(b.badge_type)}
                      </span>
                    ))}
                  </div>
                )}
                {stats.supporterSince && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-3">
                    Supporter since {stats.supporterSince}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-8 mt-6 pt-6 border-t border-white/[0.04]">
              <div>
                <p className="font-display text-2xl font-bold" style={{ color: accent }}>{stats.totalReleases}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Releases</p>
              </div>
              <div>
                <p className="font-display text-2xl font-bold" style={{ color: accent }}>{stats.totalArtists}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Artists</p>
              </div>
            </div>
          </div>

          {/* ── Stats Sidebar (1 col) ────────────────────────── */}
          <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl p-8">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-6">Supporter Stats</h2>
            <div className="space-y-5">
              {stats.supporterSince && (
                <div>
                  <p className="text-xs text-zinc-500">Supporter since</p>
                  <p className="font-display font-bold text-lg">{stats.supporterSince}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-zinc-500">Artists supported</p>
                <p className="font-display font-bold text-lg">{stats.totalArtists}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Releases owned</p>
                <p className="font-display font-bold text-lg">{stats.totalReleases}</p>
              </div>
              {stats.mostSupportedArtist && (
                <div>
                  <p className="text-xs text-zinc-500">Most supported</p>
                  <p className="font-display font-bold text-lg">{stats.mostSupportedArtist.name}</p>
                  <p className="text-[10px] text-zinc-600">
                    {stats.mostSupportedArtist.count} release{stats.mostSupportedArtist.count !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
              {favouriteGenre && (
                <div>
                  <p className="text-xs text-zinc-500">Favourite genre</p>
                  <p className="font-display font-bold text-lg capitalize">{favouriteGenre}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Top 3 Shelf (3 cols) ─────────────────────────── */}
          {localPinned.length > 0 && (
            <div className="lg:col-span-3">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="font-display text-xl font-bold">Top 3</h2>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pinned favourites</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {localPinned.map((pin, i) => {
                  const releaseBadges = getBadgesForRelease(pin.release_id)
                  return (
                    <div
                      key={pin.release_id}
                      className="group relative bg-white/[0.02] ring-1 rounded-3xl overflow-hidden transition-all hover:ring-2"
                      style={{ ringColor: `${accent}33` }}
                      draggable={editing}
                      onDragStart={editing ? (e) => handleDragStart(e, i) : undefined}
                      onDragOver={editing ? handleDragOver : undefined}
                      onDrop={editing ? (e) => handleDrop(e, i) : undefined}
                    >
                      <Link href={`/${pin.releases.artists.slug}`}>
                        {pin.releases.cover_url ? (
                          <div className="aspect-square relative">
                            <Image src={pin.releases.cover_url} alt={pin.releases.title} fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="aspect-square flex items-center justify-center" style={{ background: `${accent}11` }}>
                            <svg width="48" height="48" fill="none" stroke={accent} strokeWidth="1.5" viewBox="0 0 24 24">
                              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                            </svg>
                          </div>
                        )}
                        <div className="p-5">
                          <p className="font-display font-bold truncate group-hover:text-white transition-colors">{pin.releases.title}</p>
                          <p className="text-xs text-zinc-500 mt-1">{pin.releases.artists.name}</p>
                          <div className="flex items-center gap-2 mt-3">
                            <span className="text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                              style={{ background: `${accent}15`, color: accent }}>
                              {pin.releases.type}
                            </span>
                            {releaseBadges.map(b => (
                              <span key={b.badge_type}
                                className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-white/[0.06] text-zinc-400">
                                {badgeIcon(b.badge_type)} {badgeLabel(b.badge_type)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </Link>

                      {/* Edit mode: drag handle + remove */}
                      {editing && (
                        <>
                          <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center cursor-grab active:cursor-grabbing backdrop-blur-sm">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="text-white/70">
                              <circle cx="4" cy="3" r="1.5" /><circle cx="10" cy="3" r="1.5" />
                              <circle cx="4" cy="7" r="1.5" /><circle cx="10" cy="7" r="1.5" />
                              <circle cx="4" cy="11" r="1.5" /><circle cx="10" cy="11" r="1.5" />
                            </svg>
                          </div>
                          <button
                            onClick={(e) => { e.preventDefault(); togglePin(pin.release_id) }}
                            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-600/80 flex items-center justify-center text-white text-sm backdrop-blur-sm hover:bg-red-500 transition-colors"
                          >
                            &times;
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty Top 3 prompt (owner only) */}
          {localPinned.length === 0 && isOwner && (
            <div className="lg:col-span-3 bg-white/[0.02] border-2 border-dashed border-white/[0.06] rounded-3xl p-12 text-center">
              <p className="text-zinc-500 text-sm">Pin your 3 favourite releases to show them off.</p>
              <button onClick={() => setEditing(true)} className="mt-4 text-sm font-bold" style={{ color: accent }}>
                Start pinning &rarr;
              </button>
            </div>
          )}

          {/* ── Digital Vinyl Shelf (3 cols) ──────────────────── */}
          {purchases.length > 0 && (
            <div className="lg:col-span-3">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="font-display text-xl font-bold">Collection</h2>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {purchases.length} release{purchases.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {purchases.map((purchase) => (
                  <VinylCard
                    key={purchase.id}
                    purchase={purchase}
                    accent={accent}
                    showAmount={fan.show_purchase_amounts}
                    editing={editing}
                    isPinned={localPinned.some(p => p.release_id === purchase.releases.id)}
                    onTogglePin={togglePin}
                    badges={getBadgesForRelease(purchase.releases.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {purchases.length === 0 && (
            <div className="lg:col-span-3 bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl p-12 text-center">
              <p className="text-zinc-500 text-sm">No music yet.</p>
              <Link href="/explore" className="mt-4 inline-block text-sm font-bold" style={{ color: accent }}>
                Discover something new &rarr;
              </Link>
            </div>
          )}

          {/* ── The Wall (3 cols) ─────────────────────────────── */}
          {wallPosts.length > 0 && (
            <div className="lg:col-span-3">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="font-display text-xl font-bold">The Wall</h2>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Artist updates</span>
              </div>
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
                {wallPosts.map(post => {
                  const postAccent = resolveAccent(post.artists.accent_colour)
                  return (
                    <div key={post.id} className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-2xl p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <Link href={`/${post.artists.slug}`} className="shrink-0">
                          {post.artists.avatar_url ? (
                            <Image src={post.artists.avatar_url} alt={post.artists.name} width={36} height={36}
                              className="rounded-full object-cover w-9 h-9" />
                          ) : (
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                              style={{ background: `${postAccent}22`, color: postAccent }}>
                              {post.artists.name[0]}
                            </div>
                          )}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link href={`/${post.artists.slug}`} className="font-bold text-sm hover:text-white transition-colors truncate block">
                            {post.artists.name}
                          </Link>
                          <p className="text-[10px] text-zinc-600">{timeAgo(post.created_at)}</p>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-white/[0.04] text-zinc-500">
                          {post.post_type === 'voice_note' ? 'Voice Note' : post.post_type}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                      {post.media_url && (
                        <div className="mt-3 rounded-xl overflow-hidden">
                          {post.post_type === 'photo' ? (
                            <Image src={post.media_url} alt="Post media" width={600} height={400}
                              className="w-full h-auto object-cover max-h-80" />
                          ) : (
                            <div className="bg-white/[0.03] rounded-xl p-4 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                                style={{ background: `${postAccent}22` }}>
                                <svg width="16" height="16" fill={postAccent} viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-zinc-400 truncate">
                                  {post.post_type === 'demo' ? 'Demo' : 'Voice Note'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-zinc-900/80 py-16">
        <div className="max-w-4xl mx-auto px-6 flex flex-col items-center gap-6">
          <Image src="/insound_logo_orange.svg" alt="insound." width={80} height={32} className="h-8 w-auto" />
          <p className="text-zinc-700 text-[11px] font-medium">&copy; 2026 Insound</p>
        </div>
      </footer>
    </main>
  )
}

/* ── Vinyl Card ──────────────────────────────────────────────── */

function VinylCard({ purchase, accent, showAmount, editing, isPinned, onTogglePin, badges }: {
  purchase: FanPurchase
  accent: string
  showAmount: boolean
  editing: boolean
  isPinned: boolean
  onTogglePin: (releaseId: string) => void
  badges: FanBadge[]
}) {
  const isAlbum = purchase.releases.type === 'album'

  function handleTilt(e: React.MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    e.currentTarget.style.transform = `perspective(600px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) scale(1.02)`
  }

  function resetTilt(e: React.MouseEvent<HTMLElement>) {
    e.currentTarget.style.transform = ''
  }

  return (
    <div
      className={`group relative bg-white/[0.02] ring-1 ring-white/[0.06] rounded-2xl overflow-hidden transition-transform duration-300 ease-out ${isAlbum ? 'sm:col-span-2 sm:row-span-2' : ''}`}
      onMouseMove={handleTilt}
      onMouseLeave={resetTilt}
    >
      <Link href={`/${purchase.artists.slug}`}>
        {purchase.releases.cover_url ? (
          <div className="aspect-square relative">
            <Image src={purchase.releases.cover_url} alt={purchase.releases.title} fill className="object-cover" />
          </div>
        ) : (
          <div className="aspect-square flex items-center justify-center bg-zinc-900">
            <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-zinc-700">
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
          </div>
        )}
        <div className="p-4">
          <p className="font-display font-bold text-sm truncate group-hover:text-white transition-colors">{purchase.releases.title}</p>
          <p className="text-xs text-zinc-500 mt-1 truncate">{purchase.artists.name}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {badges.map(b => (
              <span key={b.badge_type}
                className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: `${accent}15`, color: accent }}>
                {badgeIcon(b.badge_type)} {badgeLabel(b.badge_type)}
              </span>
            ))}
          </div>
          {showAmount && (
            <p className="text-[10px] text-zinc-600 mt-2">&pound;{(purchase.amount_pence / 100).toFixed(2)}</p>
          )}
        </div>
      </Link>

      {/* Pinned indicator */}
      {isPinned && !editing && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-[10px]"
          style={{ background: accent, color: '#000' }}>
          &#9733;
        </div>
      )}

      {/* Edit mode: pin/unpin button */}
      {editing && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin(purchase.releases.id) }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm backdrop-blur-sm"
          style={isPinned
            ? { background: accent, color: '#000' }
            : { background: 'rgba(0,0,0,0.6)', color: '#fff' }
          }
        >
          {isPinned ? '★' : '☆'}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify the profile renders**

Run: `npm run dev`
The page won't be testable until a fan has set a username and made their profile public (or you're viewing as the owner). For build verification, just ensure the component compiles.

Run: `npm run build`
Expected: No type errors from FanProfileClient.tsx

- [ ] **Step 3: Commit**

```bash
git add app/[slug]/FanProfileClient.tsx
git commit -m "feat: FanProfileClient — bento layout, top 3, vinyl shelf, wall, badges"
```

---

## Task 4: Fan Settings Page

**Files:**
- Create: `app/settings/profile/page.tsx`
- Create: `app/settings/profile/ProfileSettingsClient.tsx`

Fan settings page at `/settings/profile`. Lets the fan set their username, bio, avatar, accent colour, and privacy toggles. Username is validated for format and checked for uniqueness against both `fan_profiles.username` and `artists.slug`.

- [ ] **Step 1: Create the server component**

```typescript
// app/settings/profile/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileSettingsClient } from './ProfileSettingsClient'

export const metadata: Metadata = {
  title: 'Profile Settings | Insound',
}

export default async function ProfileSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signup')

  const { data: profile } = await supabase
    .from('fan_profiles')
    .select('username, avatar_url, bio, accent_colour, is_public, show_purchase_amounts')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/welcome')

  // Fetch purchases for the "hide specific purchases" list
  const { data: purchases } = await supabase
    .from('purchases')
    .select('id, amount_pence, paid_at, releases (title, type), artists (name)')
    .eq('buyer_user_id', user.id)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })

  // Fetch currently hidden purchases
  const { data: hidden } = await supabase
    .from('fan_hidden_purchases')
    .select('purchase_id')
    .eq('user_id', user.id)

  const hiddenIds = new Set((hidden || []).map(h => h.purchase_id))

  return (
    <ProfileSettingsClient
      profile={profile}
      purchases={(purchases || []) as any}
      hiddenPurchaseIds={[...hiddenIds]}
    />
  )
}
```

- [ ] **Step 2: Create the client component**

```typescript
// app/settings/profile/ProfileSettingsClient.tsx
'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { resolveAccent, DEFAULT_ACCENT } from '@/lib/accent'

const ACCENT_COLOURS = [
  '#ea580c', '#dc2626', '#db2777', '#9333ea', '#7c3aed',
  '#4f46e5', '#2563eb', '#0891b2', '#059669', '#16a34a',
  '#65a30d', '#ca8a04', '#d97706', '#78716c', '#ffffff',
]

interface SettingsPurchase {
  id: string
  amount_pence: number
  paid_at: string
  releases: { title: string; type: string }
  artists: { name: string }
}

interface ProfileData {
  username: string | null
  avatar_url: string | null
  bio: string | null
  accent_colour: string | null
  is_public: boolean
  show_purchase_amounts: boolean
}

export function ProfileSettingsClient({ profile, purchases, hiddenPurchaseIds }: {
  profile: ProfileData
  purchases: SettingsPurchase[]
  hiddenPurchaseIds: string[]
}) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [username, setUsername] = useState(profile.username || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [accent, setAccent] = useState(profile.accent_colour || DEFAULT_ACCENT)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [isPublic, setIsPublic] = useState(profile.is_public)
  const [showAmounts, setShowAmounts] = useState(profile.show_purchase_amounts)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set(hiddenPurchaseIds))

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [uploading, setUploading] = useState(false)

  const resolvedAccent = resolveAccent(accent)

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setUploading(false); return }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('avatars').upload(path, file, { upsert: true })

    if (uploadErr) { setError(uploadErr.message); setUploading(false); return }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    setAvatarUrl(publicUrl)
    setUploading(false)
  }

  async function toggleHidePurchase(purchaseId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (hiddenIds.has(purchaseId)) {
      await supabase.from('fan_hidden_purchases')
        .delete().eq('user_id', user.id).eq('purchase_id', purchaseId)
      setHiddenIds(prev => { const next = new Set(prev); next.delete(purchaseId); return next })
    } else {
      await supabase.from('fan_hidden_purchases')
        .insert({ user_id: user.id, purchase_id: purchaseId })
      setHiddenIds(prev => new Set(prev).add(purchaseId))
    }
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess(false)

    const trimmedUsername = username.toLowerCase().trim()
      .replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

    if (trimmedUsername && !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(trimmedUsername)) {
      setError('Username must be 3-40 characters: lowercase letters, numbers, hyphens.')
      setSaving(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setSaving(false); return }

    if (trimmedUsername) {
      // Check username not taken by another fan
      const { data: existingFan } = await supabase
        .from('fan_profiles').select('id').eq('username', trimmedUsername).maybeSingle()
      if (existingFan && existingFan.id !== user.id) {
        setError(`"${trimmedUsername}" is already taken.`)
        setSaving(false)
        return
      }

      // Check username not taken by an artist slug
      const { data: existingArtist } = await supabase
        .from('artists').select('id').eq('slug', trimmedUsername).maybeSingle()
      if (existingArtist) {
        setError(`"${trimmedUsername}" is not available.`)
        setSaving(false)
        return
      }
    }

    const { error: updateErr } = await supabase
      .from('fan_profiles')
      .update({
        username: trimmedUsername || null,
        bio: bio.trim() || null,
        accent_colour: accent,
        avatar_url: avatarUrl,
        is_public: isPublic,
        show_purchase_amounts: showAmounts,
      })
      .eq('id', user.id)

    if (updateErr) {
      setError(updateErr.message)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen flex flex-col relative"
      style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)', backgroundSize: '48px 48px' }}>

      {/* Nav */}
      <nav className="sticky top-0 w-full z-50 flex justify-between items-center px-6 md:px-14 py-5 border-b border-zinc-900/80"
        style={{ background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <Link href="/" className="text-2xl font-black tracking-tighter hover:text-orange-500 transition-colors font-display"
          style={{ color: resolvedAccent }}>
          insound.
        </Link>
        {profile.username && (
          <Link href={`/${profile.username}`}
            className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
            View Profile
          </Link>
        )}
      </nav>

      <div className="flex-1 flex items-start justify-center p-6 pt-12 relative">
        <div className="w-full max-w-lg relative z-10">
          <h1 className="font-display text-2xl font-bold mb-2">Profile Settings</h1>
          <p className="text-zinc-500 text-sm mb-8">Customize your public profile.</p>

          <div className="space-y-8">

            {/* ── Avatar ─────────────────────────────────────── */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-3">Avatar</label>
              <div className="flex items-center gap-4">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold"
                    style={{ background: `${resolvedAccent}22`, color: resolvedAccent }}>
                    {username?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="text-sm font-bold px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50">
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>
            </div>

            {/* ── Username ───────────────────────────────────── */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Username</label>
              <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-4 focus-within:border-orange-600 transition-colors">
                <span className="text-zinc-600 text-sm select-none">getinsound.com/</span>
                <input type="text" placeholder="your-name" value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="flex-1 bg-transparent py-3.5 outline-none text-white text-sm placeholder-zinc-700" />
              </div>
              <p className="text-[10px] text-zinc-600 mt-1.5">Lowercase letters, numbers and hyphens. 3-40 characters.</p>
            </div>

            {/* ── Bio ────────────────────────────────────────── */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">
                Bio <span className="text-zinc-700">({280 - bio.length} remaining)</span>
              </label>
              <textarea placeholder="What kind of music do you love?" rows={3} maxLength={280}
                value={bio} onChange={e => setBio(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600 resize-none" />
            </div>

            {/* ── Accent Colour ──────────────────────────────── */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-3">Accent Colour</label>
              <div className="grid grid-cols-5 gap-3 max-w-xs">
                {ACCENT_COLOURS.map(c => (
                  <button key={c} onClick={() => setAccent(c)}
                    className={`w-full aspect-square rounded-xl transition-all ${accent === c ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110' : 'hover:scale-105'}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>

            {/* ── Privacy ────────────────────────────────────── */}
            <div className="border-t border-zinc-800 pt-8">
              <h2 className="font-display text-lg font-bold mb-6">Privacy</h2>

              <label className="flex items-center justify-between py-4 cursor-pointer group">
                <div>
                  <p className="text-sm font-bold group-hover:text-white transition-colors">Make profile public</p>
                  <p className="text-xs text-zinc-600 mt-1">Your collection will be visible at getinsound.com/{username || 'your-name'}</p>
                </div>
                <button onClick={() => setIsPublic(!isPublic)}
                  className={`w-12 h-7 rounded-full transition-colors relative ${isPublic ? '' : 'bg-zinc-700'}`}
                  style={isPublic ? { background: resolvedAccent } : {}}>
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${isPublic ? 'left-6' : 'left-1'}`} />
                </button>
              </label>

              <label className="flex items-center justify-between py-4 cursor-pointer group border-t border-zinc-900">
                <div>
                  <p className="text-sm font-bold group-hover:text-white transition-colors">Show purchase amounts</p>
                  <p className="text-xs text-zinc-600 mt-1">Display how much you paid for each release</p>
                </div>
                <button onClick={() => setShowAmounts(!showAmounts)}
                  className={`w-12 h-7 rounded-full transition-colors relative ${showAmounts ? '' : 'bg-zinc-700'}`}
                  style={showAmounts ? { background: resolvedAccent } : {}}>
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${showAmounts ? 'left-6' : 'left-1'}`} />
                </button>
              </label>
            </div>

            {/* ── Hide Specific Purchases ────────────────────── */}
            {purchases.length > 0 && (
              <div className="border-t border-zinc-800 pt-8">
                <h2 className="font-display text-lg font-bold mb-2">Collection Privacy</h2>
                <p className="text-xs text-zinc-500 mb-6">Hide specific purchases from your public profile.</p>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {purchases.map(p => {
                    const isHidden = hiddenIds.has(p.id)
                    return (
                      <div key={p.id}
                        className={`flex items-center justify-between py-3 px-4 rounded-xl transition-colors ${isHidden ? 'bg-zinc-900/50 opacity-60' : 'hover:bg-white/[0.02]'}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">{(p.releases as any).title}</p>
                          <p className="text-xs text-zinc-500">{(p.artists as any).name}</p>
                        </div>
                        <button onClick={() => toggleHidePurchase(p.id)}
                          className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors shrink-0 ml-3"
                          style={isHidden
                            ? { background: `${resolvedAccent}22`, color: resolvedAccent }
                            : { background: 'transparent', color: '#71717a', border: '1px solid #27272a' }
                          }>
                          {isHidden ? 'Show' : 'Hide'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Save + Status ──────────────────────────────── */}
            {error && (
              <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {success && (
              <div className="text-xs text-green-400 bg-green-950/40 border border-green-900/60 rounded-lg px-4 py-3">
                Settings saved.
              </div>
            )}

            <button onClick={handleSave} disabled={saving}
              className="w-full font-black py-4 rounded-xl transition-colors text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: resolvedAccent, color: '#000' }}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update middleware to recognize /settings as a known route**

In `middleware.ts`, add `'/settings'` to the `PUBLIC_ROUTES` array — actually no, settings requires auth. The current middleware behaviour is: unauthenticated users on non-public, non-excluded routes get redirected to `/signup`. This is correct for `/settings`. No middleware change is needed.

However, add `'settings'` to STATIC_ROUTES in `app/[slug]/page.tsx` — this was already done in Task 2.

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: No type errors.

Run: `npm run dev` and visit `http://localhost:3000/settings/profile` while logged in.
Expected: Settings form renders with current profile data.

- [ ] **Step 5: Commit**

```bash
git add app/settings/profile/page.tsx app/settings/profile/ProfileSettingsClient.tsx
git commit -m "feat: fan settings page — profile, privacy, accent colour, hide purchases"
```

---

## Task 5: Build Verification

- [ ] **Step 1: Run the build**

Run: `npm run build`
Expected: Build succeeds with no type errors. The new routes should appear:
- `/ [slug]` — existing (now resolves both artists and fans)
- `/settings/profile` — new

- [ ] **Step 2: Verify route list**

Check the build output for these routes:
- `f /[slug]` — dynamic, server-rendered
- `f /settings/profile` — dynamic, server-rendered

- [ ] **Step 3: Manual smoke test checklist**

Test the following (requires migration applied + a fan account):
1. Go to `/settings/profile` → set username to `test-fan` → save
2. Go to `/settings/profile` → toggle "Make profile public" → save
3. Go to `/test-fan` → should see fan profile with bento layout
4. Profile shows header with avatar/username/bio
5. Stats sidebar shows supporter stats
6. Vinyl shelf shows purchase grid with hover tilt
7. Albums render as larger bento cards (col-span-2 row-span-2)
8. Click "Edit" → pin a release → star appears on vinyl card
9. Pin 3 releases → Top 3 shelf appears
10. Drag to reorder Top 3 → positions persist on refresh
11. Click "Done" → edit mode exits
12. Toggle "Show purchase amounts" in settings → amounts appear on vinyl cards
13. Hide a purchase in settings → it disappears from the public profile
14. Toggle profile back to private → `/test-fan` returns 404 for other users
15. Visit an existing artist slug → still renders artist profile correctly
16. The Wall section appears if any artist posts exist

- [ ] **Step 4: Commit any fixes**

If any fixes were needed, commit them.

---

## Notes

### What this plan includes
- **Profile Header** with avatar, username, bio, supporter-since badge, counts
- **Top 3 Shelf** with pinned releases, drag-to-reorder, click-to-navigate
- **Digital Vinyl Shelf** with bento grid (albums large, singles small), hover tilt, badge display
- **The Wall** with artist post feed filtered by fan's purchased artists, sorted by recency
- **Supporter Stats Sidebar** with supporter since, total artists, total releases, most supported, favourite genre
- **Privacy controls** — profile public toggle, show amounts toggle, hide specific purchases
- **Badge system** — `fan_badges` table, founding_fan awarded at migration, limited_edition and early_supporter types ready
- **Schema** — `fan_pinned_releases`, `fan_hidden_purchases`, `fan_badges`, `artist_posts` tables with full RLS
- **Route resolution** — dual artist/fan at `[slug]` with parallel queries
- **Accent colour** — reuses existing `lib/accent.ts` system with per-fan customisation

### What needs follow-up work
- **Artist posting UI** — the `artist_posts` table exists and the Wall renders posts, but there's no UI for artists to create posts yet. This needs a posting form in the artist dashboard (text, photo upload, demo upload, voice note upload).
- **Badge awarding triggers** — `founding_fan` is awarded at migration time. `limited_edition` should be awarded when a fan purchases a limited-run release. `early_supporter` should be awarded for first N purchasers of any release. Both need app-level or DB-trigger logic tied to the purchase webhook.
- **Follow button** — needs a `follows` table (follower_id, followed_id) and social graph queries. Not included because it's a distinct social feature.
- **Avatar upload validation** — currently accepts any image. Should add size limits and format validation.
- **Username change notifications** — if a fan changes their username, old URLs break. Could add a redirects table later.
