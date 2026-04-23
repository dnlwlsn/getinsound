# Fan Profiles — Curated Public Shelves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing fan profile page into a hero + bento grid layout with extracted components, @dnd-kit drag-to-reorder, privacy controls, fan_follows table, and SEO metadata.

**Architecture:** Refactor the monolithic `FanProfileClient.tsx` (620 lines) into an orchestrator (~100 lines) that distributes data to focused child components. Hero section merges identity + Top 3; below it a 3-column bento grid holds Collection, Stats, Wall, and Badge Showcase modules. New `fan_follows` table decouples follows from purchases; backfill ensures continuity.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres + RLS), @dnd-kit/core + @dnd-kit/sortable, Tailwind CSS 3, TypeScript, React 18

**Spec:** `docs/superpowers/specs/2026-04-23-fan-profiles-design.md`

---

## File Structure

```
app/[slug]/
  page.tsx                          — MODIFY: add show_collection/show_wall to fan query, fan_follows wall query, SEO metadata, JSON-LD
  FanProfileClient.tsx              — REWRITE: slim orchestrator with bento grid layout (~100 lines)
  components/
    types.ts                        — CREATE: shared interfaces for all fan profile components
    FanHero.tsx                     — CREATE: avatar, identity, bio, global badges, inline Top 3
    TopThreeShelf.tsx               — CREATE: @dnd-kit sortable pinned releases
    VinylCollection.tsx             — CREATE: collection bento card with grid of VinylCards
    VinylCard.tsx                   — CREATE: extracted vinyl card with tilt + badge overlay
    SupporterStats.tsx              — CREATE: stats sidebar bento card
    BadgeShowcase.tsx               — CREATE: dedicated badge display bento card
    TheWall.tsx                     — CREATE: artist posts feed bento card
    WallPost.tsx                    — CREATE: single wall post card
app/settings/profile/
  page.tsx                          — MODIFY: add show_collection/show_wall to query
  ProfileSettingsClient.tsx         — MODIFY: add two new privacy toggles
supabase/migrations/
  0028_fan_profile_shelves.sql      — CREATE: schema changes
package.json                        — MODIFY: add @dnd-kit dependencies
```

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/0028_fan_profile_shelves.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Privacy columns
ALTER TABLE fan_profiles
  ADD COLUMN show_collection boolean NOT NULL DEFAULT true,
  ADD COLUMN show_wall boolean NOT NULL DEFAULT true;

-- Explicit follow relationship
CREATE TABLE fan_follows (
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id  uuid REFERENCES artists(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, artist_id)
);

ALTER TABLE fan_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fans can manage own follows"
  ON fan_follows FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public read follows for public profiles"
  ON fan_follows FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fan_profiles
      WHERE id = fan_follows.user_id AND is_public = true
    )
  );

CREATE INDEX fan_follows_artist_idx ON fan_follows(artist_id);

-- Backfill: every fan auto-follows artists they've purchased from
INSERT INTO fan_follows (user_id, artist_id)
SELECT DISTINCT p.buyer_user_id, p.artist_id
FROM purchases p
WHERE p.status = 'paid'
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Verify migration applies cleanly**

Run: `npx supabase db push --dry-run` (or apply locally with `npx supabase db reset`)
Expected: no errors, `fan_follows` table created, `fan_profiles` has new columns.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0028_fan_profile_shelves.sql
git commit -m "feat: add fan_follows table and privacy columns migration"
```

---

### Task 2: Install @dnd-kit

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @dnd-kit/modifiers`

- [ ] **Step 2: Verify installation**

Run: `npm ls @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @dnd-kit/modifiers`
Expected: all four packages listed without errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities"
```

---

### Task 3: Extract Shared Types

**Files:**
- Create: `app/[slug]/components/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
export interface FanRelease {
  id: string
  slug: string
  title: string
  type: string
  cover_url: string | null
  price_pence: number
}

export interface FanArtist {
  slug: string
  name: string
  accent_colour: string | null
}

export interface FanPurchase {
  id: string
  amount_pence: number
  fan_currency: string | null
  paid_at: string
  releases: FanRelease
  artists: FanArtist
}

export interface FanPinned {
  position: number
  release_id: string
  releases: FanRelease & { artists: FanArtist }
}

export interface FanBadge {
  badge_type: string
  release_id: string | null
  awarded_at: string
  metadata?: { position?: number } | null
}

export interface WallPost {
  id: string
  artist_id: string
  post_type: string
  content: string
  media_url: string | null
  created_at: string
  artists: {
    slug: string
    name: string
    accent_colour: string | null
    avatar_url: string | null
  }
}

export interface FanStats {
  supporterSince: number | null
  totalArtists: number
  totalReleases: number
  mostSupportedArtist: { name: string; count: number } | null
}

export interface FanProfile {
  id: string
  username: string
  avatar_url: string | null
  bio: string | null
  accent_colour: string | null
  is_public: boolean
  show_purchase_amounts: boolean
  show_collection: boolean
  show_wall: boolean
  created_at: string
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\[slug\]/components/types.ts
git commit -m "feat: extract shared fan profile types"
```

---

### Task 4: WallPost Component

**Files:**
- Create: `app/[slug]/components/WallPost.tsx`

- [ ] **Step 1: Create the component**

Extract the wall post card from the current `FanProfileClient.tsx` (lines 471-517). This is a pure presentational component.

```tsx
import Link from 'next/link'
import Image from 'next/image'
import { resolveAccent } from '@/lib/accent'
import type { WallPost as WallPostType } from './types'

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

export function WallPostCard({ post }: { post: WallPostType }) {
  const postAccent = resolveAccent(post.artists.accent_colour)

  return (
    <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-2xl p-5">
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
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\[slug\]/components/WallPost.tsx
git commit -m "feat: extract WallPost component"
```

---

### Task 5: TheWall Component

**Files:**
- Create: `app/[slug]/components/TheWall.tsx`

- [ ] **Step 1: Create the component**

Wraps a list of `WallPostCard` components in a bento card with header and scroll container.

```tsx
import type { WallPost } from './types'
import { WallPostCard } from './WallPost'

export function TheWall({ posts }: { posts: WallPost[] }) {
  if (posts.length === 0) return null

  return (
    <div className="lg:col-span-2 bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="font-display text-xl font-bold">The Wall</h2>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Artist updates</span>
      </div>
      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
        {posts.map(post => (
          <WallPostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\[slug\]/components/TheWall.tsx
git commit -m "feat: extract TheWall bento card component"
```

---

### Task 6: SupporterStats Component

**Files:**
- Create: `app/[slug]/components/SupporterStats.tsx`

- [ ] **Step 1: Create the component**

Extract the stats sidebar from `FanProfileClient.tsx` (lines 299-332) into a bento card.

```tsx
import type { FanStats } from './types'

export function SupporterStats({ stats, favouriteGenre, accent }: {
  stats: FanStats
  favouriteGenre: string | null
  accent: string
}) {
  return (
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
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\[slug\]/components/SupporterStats.tsx
git commit -m "feat: extract SupporterStats bento card component"
```

---

### Task 7: BadgeShowcase Component

**Files:**
- Create: `app/[slug]/components/BadgeShowcase.tsx`

- [ ] **Step 1: Create the component**

A dedicated bento card for displaying all earned badges. Uses the existing `BadgeList` component from `app/components/ui/Badge.tsx`.

```tsx
import { BadgeList } from '@/app/components/ui/Badge'
import type { FanBadge } from './types'

export function BadgeShowcase({ badges, accent }: {
  badges: FanBadge[]
  accent: string
}) {
  if (badges.length === 0) return null

  const globalBadges = badges.filter(b => !b.release_id)
  const releaseBadges = badges.filter(b => b.release_id)

  return (
    <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl p-8">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-6">Badges</h2>
      <div className="space-y-4">
        {globalBadges.length > 0 && (
          <div>
            <BadgeList badges={globalBadges} />
          </div>
        )}
        {releaseBadges.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">
              {releaseBadges.length} release badge{releaseBadges.length !== 1 ? 's' : ''}
            </p>
            <BadgeList badges={releaseBadges} size="xs" />
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\[slug\]/components/BadgeShowcase.tsx
git commit -m "feat: extract BadgeShowcase bento card component"
```

---

### Task 8: VinylCard Component

**Files:**
- Create: `app/[slug]/components/VinylCard.tsx`

- [ ] **Step 1: Create the component**

Extract from `FanProfileClient.tsx` (lines 539-621). Add badge overlay on hover over cover art. Import `useCurrency` for price formatting.

```tsx
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCurrency } from '@/app/providers/CurrencyProvider'
import type { FanPurchase, FanBadge } from './types'

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

export function VinylCard({ purchase, accent, showAmount, editing, isPinned, onTogglePin, badges }: {
  purchase: FanPurchase
  accent: string
  showAmount: boolean
  editing: boolean
  isPinned: boolean
  onTogglePin: (releaseId: string) => void
  badges: FanBadge[]
}) {
  const { formatPrice } = useCurrency()
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
      className={`group relative bg-white/[0.02] ring-1 ring-white/[0.06] rounded-2xl overflow-hidden transition-transform duration-300 ease-out ${isAlbum ? 'col-span-2 row-span-2' : ''}`}
      onMouseMove={handleTilt}
      onMouseLeave={resetTilt}
    >
      <Link href={`/${purchase.artists.slug}`}>
        <div className="aspect-square relative">
          {purchase.releases.cover_url ? (
            <Image src={purchase.releases.cover_url} alt={purchase.releases.title} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900">
              <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-zinc-700">
                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          )}
          {/* Badge overlay on hover */}
          {badges.length > 0 && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-3">
              <div className="flex flex-wrap gap-1">
                {badges.map(b => (
                  <span key={b.badge_type}
                    className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{ background: `${accent}30`, color: accent }}>
                    {badgeIcon(b.badge_type)} {badgeLabel(b.badge_type)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="p-4">
          <p className="font-display font-bold text-sm truncate group-hover:text-white transition-colors">{purchase.releases.title}</p>
          <p className="text-xs text-zinc-500 mt-1 truncate">{purchase.artists.name}</p>
          {showAmount && (
            <p className="text-[10px] text-zinc-600 mt-2">{formatPrice(purchase.amount_pence / 100, purchase.fan_currency || 'GBP')}</p>
          )}
        </div>
      </Link>

      {isPinned && !editing && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-[10px]"
          style={{ background: accent, color: '#000' }}>
          &#9733;
        </div>
      )}

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

- [ ] **Step 2: Commit**

```bash
git add app/\[slug\]/components/VinylCard.tsx
git commit -m "feat: extract VinylCard with badge overlay on hover"
```

---

### Task 9: VinylCollection Component

**Files:**
- Create: `app/[slug]/components/VinylCollection.tsx`

- [ ] **Step 1: Create the component**

Bento card wrapping the collection grid. Receives purchases, filters hidden ones, renders `VinylCard` components.

```tsx
'use client'

import Link from 'next/link'
import { VinylCard } from './VinylCard'
import type { FanPurchase, FanPinned, FanBadge } from './types'

export function VinylCollection({ purchases, pinned, badges, accent, showAmount, editing, isOwner, onTogglePin }: {
  purchases: FanPurchase[]
  pinned: FanPinned[]
  badges: FanBadge[]
  accent: string
  showAmount: boolean
  editing: boolean
  isOwner: boolean
  onTogglePin: (releaseId: string) => void
}) {
  if (purchases.length === 0) {
    return (
      <div className="lg:col-span-2 bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl p-12 text-center">
        {isOwner ? (
          <>
            <p className="text-zinc-400 text-sm">Your collection is empty. Once you start buying music, it&rsquo;ll appear here.</p>
            <Link href="/discover" className="mt-4 inline-block text-sm font-bold" style={{ color: accent }}>
              Discover music &rarr;
            </Link>
          </>
        ) : (
          <p className="text-zinc-500 text-sm">No music yet.</p>
        )}
      </div>
    )
  }

  function getBadgesForRelease(releaseId: string): FanBadge[] {
    return badges.filter(b => b.release_id === releaseId)
  }

  return (
    <div className="lg:col-span-2 bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="font-display text-xl font-bold">Collection</h2>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          {purchases.length} release{purchases.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {purchases.map(purchase => (
          <VinylCard
            key={purchase.id}
            purchase={purchase}
            accent={accent}
            showAmount={showAmount}
            editing={editing}
            isPinned={pinned.some(p => p.release_id === purchase.releases.id)}
            onTogglePin={onTogglePin}
            badges={getBadgesForRelease(purchase.releases.id)}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\[slug\]/components/VinylCollection.tsx
git commit -m "feat: extract VinylCollection bento card component"
```

---

### Task 10: TopThreeShelf with @dnd-kit

**Files:**
- Create: `app/[slug]/components/TopThreeShelf.tsx`

- [ ] **Step 1: Create the component**

Replaces the native HTML5 drag-and-drop with `@dnd-kit/sortable`. In edit mode, cards are wrapped in a sortable context. In view mode, cards render without DnD overhead.

```tsx
'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToParentElement } from '@dnd-kit/modifiers'
import type { FanPinned, FanBadge } from './types'

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

function SortableCard({ pin, accent, badges, editing, onRemove }: {
  pin: FanPinned
  accent: string
  badges: FanBadge[]
  editing: boolean
  onRemove: (releaseId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pin.release_id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    ringColor: `${accent}33`,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative bg-white/[0.02] ring-1 rounded-3xl overflow-hidden transition-all hover:ring-2"
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
            {badges.map(b => (
              <span key={b.badge_type}
                className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-white/[0.06] text-zinc-400">
                {badgeIcon(b.badge_type)} {badgeLabel(b.badge_type)}
              </span>
            ))}
          </div>
        </div>
      </Link>

      {editing && (
        <>
          <div
            {...attributes}
            {...listeners}
            className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center cursor-grab active:cursor-grabbing backdrop-blur-sm"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="text-white/70">
              <circle cx="4" cy="3" r="1.5" /><circle cx="10" cy="3" r="1.5" />
              <circle cx="4" cy="7" r="1.5" /><circle cx="10" cy="7" r="1.5" />
              <circle cx="4" cy="11" r="1.5" /><circle cx="10" cy="11" r="1.5" />
            </svg>
          </div>
          <button
            onClick={(e) => { e.preventDefault(); onRemove(pin.release_id) }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-600/80 flex items-center justify-center text-white text-sm backdrop-blur-sm hover:bg-red-500 transition-colors"
          >
            &times;
          </button>
        </>
      )}
    </div>
  )
}

function PinnedCard({ pin, accent, badges }: {
  pin: FanPinned
  accent: string
  badges: FanBadge[]
}) {
  return (
    <div
      className="group relative bg-white/[0.02] ring-1 rounded-3xl overflow-hidden transition-all hover:ring-2"
      style={{ ringColor: `${accent}33` }}
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
            {badges.map(b => (
              <span key={b.badge_type}
                className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-white/[0.06] text-zinc-400">
                {badgeIcon(b.badge_type)} {badgeLabel(b.badge_type)}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </div>
  )
}

export function TopThreeShelf({ pinned, badges, accent, editing, onReorder, onRemove }: {
  pinned: FanPinned[]
  badges: FanBadge[]
  accent: string
  editing: boolean
  onReorder: (reordered: FanPinned[]) => void
  onRemove: (releaseId: string) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = pinned.findIndex(p => p.release_id === active.id)
    const newIndex = pinned.findIndex(p => p.release_id === over.id)
    const reordered = arrayMove(pinned, oldIndex, newIndex).map((pin, i) => ({
      ...pin,
      position: i + 1,
    }))
    onReorder(reordered)
  }, [pinned, onReorder])

  function getBadgesForRelease(releaseId: string): FanBadge[] {
    return badges.filter(b => b.release_id === releaseId)
  }

  if (pinned.length === 0) return null

  if (editing) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={pinned.map(p => p.release_id)} strategy={horizontalListSortingStrategy}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {pinned.map(pin => (
              <SortableCard
                key={pin.release_id}
                pin={pin}
                accent={accent}
                badges={getBadgesForRelease(pin.release_id)}
                editing={editing}
                onRemove={onRemove}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {pinned.map(pin => (
        <PinnedCard
          key={pin.release_id}
          pin={pin}
          accent={accent}
          badges={getBadgesForRelease(pin.release_id)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build` (or `npm run build`)
Expected: compiles without type errors.

- [ ] **Step 3: Commit**

```bash
git add app/\[slug\]/components/TopThreeShelf.tsx
git commit -m "feat: TopThreeShelf with @dnd-kit sortable drag-to-reorder"
```

---

### Task 11: FanHero Component

**Files:**
- Create: `app/[slug]/components/FanHero.tsx`

- [ ] **Step 1: Create the component**

Merges the profile header and Top 3 shelf into a single hero section. Left side: identity. Right side: pinned releases.

```tsx
'use client'

import Image from 'next/image'
import { BadgeList } from '@/app/components/ui/Badge'
import { TopThreeShelf } from './TopThreeShelf'
import type { FanProfile, FanPinned, FanBadge, FanStats } from './types'

export function FanHero({ fan, pinned, badges, stats, accent, editing, isOwner, onReorder, onRemove, onStartEditing }: {
  fan: FanProfile
  pinned: FanPinned[]
  badges: FanBadge[]
  stats: FanStats
  accent: string
  editing: boolean
  isOwner: boolean
  onReorder: (reordered: FanPinned[]) => void
  onRemove: (releaseId: string) => void
  onStartEditing: () => void
}) {
  const globalBadges = badges.filter(b => !b.release_id)

  return (
    <div className="mb-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left: Identity */}
        <div className="flex-1 min-w-0">
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
              {globalBadges.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <BadgeList badges={globalBadges} />
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

        {/* Right: Top 3 */}
        <div className="w-full lg:w-[55%] shrink-0">
          {pinned.length > 0 ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-display text-xl font-bold">Top 3</h2>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pinned favourites</span>
              </div>
              <TopThreeShelf
                pinned={pinned}
                badges={badges}
                accent={accent}
                editing={editing}
                onReorder={onReorder}
                onRemove={onRemove}
              />
            </>
          ) : isOwner ? (
            <div className="bg-white/[0.02] border-2 border-dashed border-white/[0.06] rounded-3xl p-12 text-center">
              <p className="text-zinc-500 text-sm">Pin your 3 favourite releases to show them off.</p>
              <button onClick={onStartEditing} className="mt-4 text-sm font-bold" style={{ color: accent }}>
                Start pinning &rarr;
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\[slug\]/components/FanHero.tsx
git commit -m "feat: FanHero component merging identity + Top 3 shelf"
```

---

### Task 12: Rewrite FanProfileClient as Orchestrator

**Files:**
- Modify: `app/[slug]/FanProfileClient.tsx`

- [ ] **Step 1: Rewrite the file**

Replace the entire 620-line file with a slim orchestrator that imports child components and manages state.

```tsx
'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { resolveAccent } from '@/lib/accent'
import { createClient } from '@/lib/supabase/client'
import { FanHero } from './components/FanHero'
import { VinylCollection } from './components/VinylCollection'
import { SupporterStats } from './components/SupporterStats'
import { BadgeShowcase } from './components/BadgeShowcase'
import { TheWall } from './components/TheWall'
import type { FanProfile, FanPurchase, FanPinned, FanBadge, WallPost, FanStats } from './components/types'

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

export function FanProfileClient({ fan, purchases, pinned, badges, wallPosts, stats, favouriteGenre, isOwner }: Props) {
  const accent = resolveAccent(fan.accent_colour)
  const supabase = createClient()

  const [editing, setEditing] = useState(false)
  const [localPinned, setLocalPinned] = useState<FanPinned[]>(pinned)

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

  const handleReorder = useCallback(async (reordered: FanPinned[]) => {
    setLocalPinned(reordered)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    for (const pin of reordered) {
      await supabase.from('fan_pinned_releases')
        .update({ position: pin.position })
        .eq('user_id', user.id)
        .eq('release_id', pin.release_id)
    }
  }, [supabase])

  return (
    <main className="bg-[#0A0A0A] text-white min-h-screen">
      {/* Nav */}
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
        {/* Private profile banner */}
        {isOwner && !fan.is_public && (
          <div className="mb-8 bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 flex items-center justify-between gap-4">
            <p className="text-sm text-zinc-400">
              This is how your profile looks. It&rsquo;s currently <span className="text-white font-bold">private</span> — only you can see this.
            </p>
            <Link href="/settings/profile"
              className="shrink-0 text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full transition-colors"
              style={{ color: accent, border: `1px solid ${accent}33` }}>
              Settings
            </Link>
          </div>
        )}

        {/* Hero: Identity + Top 3 */}
        <FanHero
          fan={fan}
          pinned={localPinned}
          badges={badges}
          stats={stats}
          accent={accent}
          editing={editing}
          isOwner={isOwner}
          onReorder={handleReorder}
          onRemove={togglePin}
          onStartEditing={() => setEditing(true)}
        />

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {fan.show_collection && (
            <VinylCollection
              purchases={purchases}
              pinned={localPinned}
              badges={badges}
              accent={accent}
              showAmount={fan.show_purchase_amounts}
              editing={editing}
              isOwner={isOwner}
              onTogglePin={togglePin}
            />
          )}

          <SupporterStats stats={stats} favouriteGenre={favouriteGenre} accent={accent} />

          {fan.show_wall && <TheWall posts={wallPosts} />}

          <BadgeShowcase badges={badges} accent={accent} />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-900/80 py-16">
        <div className="max-w-4xl mx-auto px-6 flex flex-col items-center gap-6">
          <Image src="/insound_logo_orange.svg" alt="insound." width={80} height={32} className="h-8 w-auto" />
          <p className="text-zinc-700 text-[11px] font-medium">&copy; 2026 Insound</p>
        </div>
      </footer>
    </main>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add app/\[slug\]/FanProfileClient.tsx
git commit -m "feat: rewrite FanProfileClient as slim bento grid orchestrator"
```

---

### Task 13: Update Server Page — Queries, SEO, and JSON-LD

**Files:**
- Modify: `app/[slug]/page.tsx`

- [ ] **Step 1: Update fan_profiles select to include new columns**

In `app/[slug]/page.tsx`, find the fan profile select query (line 58):

```typescript
.select('id, username, avatar_url, bio, accent_colour, is_public, show_purchase_amounts, created_at')
```

Replace with:

```typescript
.select('id, username, avatar_url, bio, accent_colour, is_public, show_purchase_amounts, show_collection, show_wall, created_at')
```

- [ ] **Step 2: Update wall posts query to use fan_follows**

Replace the wall posts section (lines 93-119) which currently queries purchases for artist IDs:

```typescript
    const { data: purchaseArtistIds } = await supabase
      .from('purchases')
      .select('artist_id')
      .eq('buyer_user_id', fan.id)
      .eq('status', 'paid')

    const uniqueArtistIds = [...new Set((purchaseArtistIds || []).map(p => p.artist_id))]

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
```

Replace with:

```typescript
    const { data: followedArtistIds } = await supabase
      .from('fan_follows')
      .select('artist_id')
      .eq('user_id', fan.id)

    const uniqueArtistIds = [...new Set((followedArtistIds || []).map(f => f.artist_id))]

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
```

- [ ] **Step 3: Filter hidden purchases for non-owners**

After the `Promise.all` block that fetches purchases (around line 88), add hidden purchase filtering before passing to the client. Insert after `const purchases = purchasesRes.data || []`:

```typescript
    let visiblePurchases = purchases
    if (!isOwner) {
      const { data: hidden } = await supabase
        .from('fan_hidden_purchases')
        .select('purchase_id')
        .eq('user_id', fan.id)
      const hiddenIds = new Set((hidden || []).map(h => h.purchase_id))
      visiblePurchases = purchases.filter(p => !hiddenIds.has(p.id))
    }
```

Then update the return statement to pass `visiblePurchases` instead of `purchases` to `FanProfileClient`, and use `visiblePurchases` for stats calculations (artist counts, supporter since, etc.).

- [ ] **Step 4: Update generateMetadata for fan profiles**

Replace the fan metadata block (lines 16-28):

```typescript
  if (slug.startsWith('@')) {
    const username = slug.slice(1)
    if (!username) return {}
    const supabase = await createClient()
    const { data: fan } = await supabase
      .from('fan_profiles')
      .select('username, bio')
      .eq('username', username)
      .maybeSingle()
    if (!fan) return {}
    const title = `${fan.username} | insound.`
    const description = fan.bio || `${fan.username}'s music collection on Insound.`
    return { title, description, openGraph: { title, description, type: 'profile' } }
  }
```

Replace with:

```typescript
  if (slug.startsWith('@')) {
    const username = slug.slice(1)
    if (!username) return {}
    const supabase = await createClient()
    const { data: fan } = await supabase
      .from('fan_profiles')
      .select('username, bio, avatar_url, is_public')
      .eq('username', username)
      .maybeSingle()
    if (!fan || !fan.is_public) return {}
    const title = `${fan.username}'s Collection | Insound`
    const description = fan.bio || `${fan.username}'s music collection on Insound.`
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'profile',
        ...(fan.avatar_url ? { images: [{ url: fan.avatar_url }] } : {}),
      },
    }
  }
```

- [ ] **Step 5: Add JSON-LD structured data**

In the fan profile return block (around line 135), wrap the `FanProfileClient` with JSON-LD. Replace:

```typescript
    return (
      <FanProfileClient
```

With:

```typescript
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Person',
              name: fan.username,
              ...(fan.avatar_url ? { image: fan.avatar_url } : {}),
              ...(fan.bio ? { description: fan.bio } : {}),
              interactionStatistic: {
                '@type': 'InteractionCounter',
                interactionType: 'https://schema.org/BuyAction',
                userInteractionCount: visiblePurchases.length,
              },
            }),
          }}
        />
        <FanProfileClient
```

And close the fragment after the `FanProfileClient` closing tag (after the `/>` around line 151):

```typescript
        />
      </>
    )
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: compiles without errors.

- [ ] **Step 7: Commit**

```bash
git add app/\[slug\]/page.tsx
git commit -m "feat: update fan profile queries, SEO metadata, and JSON-LD"
```

---

### Task 14: Privacy Toggles in Settings

**Files:**
- Modify: `app/settings/profile/page.tsx`
- Modify: `app/settings/profile/ProfileSettingsClient.tsx`

- [ ] **Step 1: Update server page to fetch new columns**

In `app/settings/profile/page.tsx`, update the select query:

```typescript
.select('username, avatar_url, bio, accent_colour, is_public, show_purchase_amounts')
```

Replace with:

```typescript
.select('username, avatar_url, bio, accent_colour, is_public, show_purchase_amounts, show_collection, show_wall')
```

- [ ] **Step 2: Update ProfileData interface**

In `app/settings/profile/ProfileSettingsClient.tsx`, update the `ProfileData` interface (line 25-31):

```typescript
interface ProfileData {
  username: string | null
  avatar_url: string | null
  bio: string | null
  accent_colour: string | null
  is_public: boolean
  show_purchase_amounts: boolean
}
```

Replace with:

```typescript
interface ProfileData {
  username: string | null
  avatar_url: string | null
  bio: string | null
  accent_colour: string | null
  is_public: boolean
  show_purchase_amounts: boolean
  show_collection: boolean
  show_wall: boolean
}
```

- [ ] **Step 3: Add state for new toggles**

After `const [showAmounts, setShowAmounts] = useState(profile.show_purchase_amounts)` (line 47), add:

```typescript
  const [showCollection, setShowCollection] = useState(profile.show_collection)
  const [showWall, setShowWall] = useState(profile.show_wall)
```

- [ ] **Step 4: Include new fields in the save handler**

In the `handleSave` function, update the `.update()` call (line 129-136):

```typescript
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
```

Replace with:

```typescript
    const { error: updateErr } = await supabase
      .from('fan_profiles')
      .update({
        username: trimmedUsername || null,
        bio: bio.trim() || null,
        accent_colour: accent,
        avatar_url: avatarUrl,
        is_public: isPublic,
        show_purchase_amounts: showAmounts,
        show_collection: showCollection,
        show_wall: showWall,
      })
      .eq('id', user.id)
```

- [ ] **Step 5: Add toggle UI**

After the "Show purchase amounts" toggle (after line 273, before the closing `</div>` of the Privacy section), add:

```tsx
              <label className="flex items-center justify-between py-4 cursor-pointer group border-t border-zinc-900">
                <div>
                  <p className="text-sm font-bold group-hover:text-white transition-colors">Show collection</p>
                  <p className="text-xs text-zinc-600 mt-1">Display your full music collection on your public profile</p>
                </div>
                <button onClick={() => setShowCollection(!showCollection)}
                  className={`w-12 h-7 rounded-full transition-colors relative ${showCollection ? '' : 'bg-zinc-700'}`}
                  style={showCollection ? { background: resolvedAccent } : {}}>
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${showCollection ? 'left-6' : 'left-1'}`} />
                </button>
              </label>

              <label className="flex items-center justify-between py-4 cursor-pointer group border-t border-zinc-900">
                <div>
                  <p className="text-sm font-bold group-hover:text-white transition-colors">Show The Wall</p>
                  <p className="text-xs text-zinc-600 mt-1">Display artist updates on your public profile</p>
                </div>
                <button onClick={() => setShowWall(!showWall)}
                  className={`w-12 h-7 rounded-full transition-colors relative ${showWall ? '' : 'bg-zinc-700'}`}
                  style={showWall ? { background: resolvedAccent } : {}}>
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${showWall ? 'left-6' : 'left-1'}`} />
                </button>
              </label>
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: compiles without errors.

- [ ] **Step 7: Commit**

```bash
git add app/settings/profile/page.tsx app/settings/profile/ProfileSettingsClient.tsx
git commit -m "feat: add show_collection and show_wall privacy toggles to settings"
```

---

### Task 15: Manual Testing and Polish

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Test the fan profile page**

Navigate to `/@[your-username]` and verify:
- Hero section renders with identity on left, Top 3 on right
- Bento grid below with Collection (col-span-2), Stats (col-span-1), Wall (col-span-2), Badges (col-span-1)
- Mobile responsive: stack to single column at small breakpoints
- Empty states display correctly for users with no purchases/pins/badges

- [ ] **Step 3: Test drag-to-reorder**

Click "Edit" in the nav, then:
- Drag a pinned release to reorder — verify smooth animation
- Remove a pinned release — verify it disappears
- Pin a release from collection — verify it appears in Top 3
- Keyboard reorder: tab to a drag handle, use arrow keys

- [ ] **Step 4: Test privacy controls**

Go to `/settings/profile`:
- Toggle "Show collection" off, save, visit profile — collection should be hidden
- Toggle "Show The Wall" off, save, visit profile — wall should be hidden
- Toggle profile to private — non-authenticated visit should 404

- [ ] **Step 5: Test badge overlay**

Hover over a vinyl card that has badges — badges should fade in over the cover art.

- [ ] **Step 6: Verify SEO**

View page source on a public fan profile:
- Check `<title>` is `"username's Collection | Insound"`
- Check `og:image` is set to avatar URL
- Check JSON-LD script tag with `Person` schema

- [ ] **Step 7: Fix any issues found during testing**

Address any visual, functional, or responsive issues.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "fix: fan profile polish from manual testing"
```
