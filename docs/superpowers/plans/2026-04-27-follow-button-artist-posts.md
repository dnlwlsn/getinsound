# Follow Button + Artist Posts Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Follow button to artist profiles, rewire post notifications to followers, auto-follow on purchase, show follower count, notify artists on new follow, and display an Updates section on artist profiles.

**Architecture:** New `/api/follows` route handles follow/unfollow. A client-side `FollowButton` component (same pattern as `FavouriteButton`) manages optimistic state. The existing `WallPostCard` component is reused to render posts on artist profiles. The Stripe webhook gets an auto-follow upsert. Post notifications switch from querying `purchases` to querying `fan_follows`.

**Tech Stack:** Next.js App Router, Supabase (client + server), TypeScript, Tailwind CSS

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `app/api/follows/route.ts` | Create | POST/DELETE endpoints for follow/unfollow + new-follower notification |
| `app/components/ui/FollowButton.tsx` | Create | Client-side follow/unfollow toggle button |
| `app/[slug]/page.tsx` | Modify | Fetch follower count + artist posts server-side, pass as props |
| `app/[slug]/ArtistProfileClient.tsx` | Modify | Render FollowButton in header + Updates section below merch |
| `app/api/posts/route.ts` | Modify | Change notification recipients from purchases to fan_follows |
| `supabase/functions/stripe-webhook/index.ts` | Modify | Add auto-follow upsert after purchase |
| `lib/notifications.ts` | Modify | Add `'new_follower'` to NotificationType union |

---

### Task 1: Add `new_follower` notification type

**Files:**
- Modify: `lib/notifications.ts:3-5`

- [ ] **Step 1: Add the type**

In `lib/notifications.ts`, add `'new_follower'` to the `NotificationType` union:

```typescript
export type NotificationType =
  | 'new_release' | 'preorder_ready' | 'order_dispatched' | 'artist_post'
  | 'sale' | 'first_sale' | 'preorder' | 'merch_order' | 'code_redeemed' | 'zero_fees_unlocked'
  | 'merch_dispatched' | 'merch_delivered' | 'merch_return' | 'merch_dispute'
  | 'new_follower'
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors related to NotificationType.

- [ ] **Step 3: Commit**

```bash
git add lib/notifications.ts
git commit -m "feat: add new_follower notification type"
```

---

### Task 2: Create `/api/follows` route

**Files:**
- Create: `app/api/follows/route.ts`

- [ ] **Step 1: Create the route file**

Create `app/api/follows/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.artist_id || typeof body.artist_id !== 'string') {
    return NextResponse.json({ error: 'artist_id required' }, { status: 400 })
  }

  if (body.artist_id === user.id) {
    return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
  }

  const { error } = await supabase
    .from('fan_follows')
    .insert({ user_id: user.id, artist_id: body.artist_id })

  if (error) {
    if (error.code === '23505') return NextResponse.json({ ok: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: fan } = await supabase
    .from('fan_profiles')
    .select('username, is_public')
    .eq('id', user.id)
    .maybeSingle()

  const fanLabel = fan?.is_public && fan.username ? fan.username : 'A new fan'

  await createNotification({
    supabase,
    userId: body.artist_id,
    type: 'new_follower',
    title: `${fanLabel} started following you`,
    link: fan?.is_public && fan.username ? `/@${fan.username}` : undefined,
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.artist_id || typeof body.artist_id !== 'string') {
    return NextResponse.json({ error: 'artist_id required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('fan_follows')
    .delete()
    .eq('user_id', user.id)
    .eq('artist_id', body.artist_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/follows/route.ts
git commit -m "feat: add /api/follows POST and DELETE endpoints"
```

---

### Task 3: Create `FollowButton` component

**Files:**
- Create: `app/components/ui/FollowButton.tsx`

- [ ] **Step 1: Create the component**

Create `app/components/ui/FollowButton.tsx`:

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  artistId: string
  initialFollowing?: boolean
  initialCount?: number
}

export function FollowButton({ artistId, initialFollowing = false, initialCount = 0 }: Props) {
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [following, setFollowing] = useState(initialFollowing)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [hover, setHover] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
      if (user) {
        supabase
          .from('fan_follows')
          .select('user_id')
          .eq('user_id', user.id)
          .eq('artist_id', artistId)
          .maybeSingle()
          .then(({ data }) => {
            setFollowing(!!data)
          })
      }
    })
  }, [artistId])

  const handleClick = useCallback(async () => {
    if (userId === null) {
      setShowPrompt(true)
      setTimeout(() => setShowPrompt(false), 3000)
      return
    }

    setLoading(true)
    const wasFollowing = following
    setFollowing(!wasFollowing)
    setCount(c => wasFollowing ? c - 1 : c + 1)

    try {
      const res = await fetch('/api/follows', {
        method: wasFollowing ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist_id: artistId }),
      })
      if (!res.ok) {
        setFollowing(wasFollowing)
        setCount(c => wasFollowing ? c + 1 : c - 1)
      }
    } catch {
      setFollowing(wasFollowing)
      setCount(c => wasFollowing ? c + 1 : c - 1)
    } finally {
      setLoading(false)
    }
  }, [userId, following, artistId])

  if (userId === undefined) return null
  if (userId === artistId) return null

  const label = following ? (hover ? 'Unfollow' : 'Following') : 'Follow'

  return (
    <span className="relative">
      <button
        onClick={handleClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        disabled={loading}
        className={`
          px-4 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all
          ${loading ? 'opacity-50 cursor-not-allowed' : ''}
          ${following
            ? hover
              ? 'bg-red-900/40 text-red-400 ring-1 ring-red-500/40'
              : 'bg-orange-600 text-black'
            : 'bg-transparent text-white ring-1 ring-white/[0.12] hover:ring-orange-500/50 hover:text-orange-400'
          }
        `}
      >
        {label}
      </button>
      {count > 0 && (
        <span className="ml-2 text-[11px] text-zinc-500 font-bold">
          {count.toLocaleString()} follower{count === 1 ? '' : 's'}
        </span>
      )}
      {showPrompt && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap bg-zinc-800 border border-zinc-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl z-50">
          Sign in to follow
        </span>
      )}
    </span>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/ui/FollowButton.tsx
git commit -m "feat: add FollowButton component with optimistic toggle"
```

---

### Task 4: Wire FollowButton + Updates into artist profile

**Files:**
- Modify: `app/[slug]/page.tsx:218-283`
- Modify: `app/[slug]/ArtistProfileClient.tsx:1-77, 155, 226-268, 630-663`

- [ ] **Step 1: Fetch follower count and posts server-side**

In `app/[slug]/page.tsx`, add two more queries to the `Promise.all` on line 228. Change from:

```typescript
  const [{ data: releases }, { data: artistBadges }, { data: accountData }, { data: merchItems }] = await Promise.all([
```

To:

```typescript
  const [{ data: releases }, { data: artistBadges }, { data: accountData }, { data: merchItems }, { count: followerCount }, { data: artistPosts }] = await Promise.all([
```

Add these two queries after the existing merch query (before the closing `])`):

```typescript
    supabase
      .from('fan_follows')
      .select('*', { count: 'exact', head: true })
      .eq('artist_id', artist.id),
    supabase
      .from('artist_posts')
      .select('id, artist_id, post_type, content, media_url, created_at')
      .eq('artist_id', artist.id)
      .order('created_at', { ascending: false })
      .limit(10),
```

- [ ] **Step 2: Pass new props to ArtistProfileClient**

In the same file, update the `<ArtistProfileClient` JSX (around line 271) to include the new props:

```tsx
    <ArtistProfileClient
      artist={artist}
      releases={(releases || []).map(r => ({
        ...r,
        tracks: [...(r.tracks || [])].sort((a, b) => a.position - b.position),
      }))}
      badges={artistBadges || []}
      verified={isVerified}
      socialLinks={artist.social_links}
      merch={merchItems || []}
      followerCount={followerCount ?? 0}
      posts={artistPosts || []}
    />
```

- [ ] **Step 3: Update ArtistProfileClient Props and imports**

In `app/[slug]/ArtistProfileClient.tsx`, add the import at the top (after the existing imports):

```typescript
import { FollowButton } from '@/app/components/ui/FollowButton'
import { WallPostCard } from '@/app/[slug]/components/WallPost'
import type { WallPost } from '@/app/[slug]/components/types'
```

Add a new `ArtistPost` interface and update the `Props` interface:

```typescript
interface ArtistPost {
  id: string
  artist_id: string
  post_type: string
  content: string
  media_url: string | null
  created_at: string
}

interface Props {
  artist: Artist
  releases: Release[]
  badges?: ArtistBadge[]
  verified?: boolean
  socialLinks?: SocialLinks | null
  merch?: MerchItem[]
  followerCount?: number
  posts?: ArtistPost[]
}
```

- [ ] **Step 4: Update component signature and add posts state**

Update the component function signature at line 155:

```typescript
export default function ArtistProfileClient({ artist, releases, badges = [], verified = false, socialLinks, merch = [], followerCount = 0, posts = [] }: Props) {
```

- [ ] **Step 5: Add FollowButton to the artist header**

In the artist header section (around line 237, after the `<div className="text-center sm:text-left flex-1">` block), add the FollowButton after the releases count (after line 256, before the closing `</div>` of the text-center div):

```tsx
            <FollowButton artistId={artist.id} initialCount={followerCount} />
```

- [ ] **Step 6: Add Updates section before the closing `</main>`**

Add the Updates section after the merch section (after line 654, before the Toast `<div>`):

```tsx
      {posts.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 md:px-12 pb-32">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-8">Updates</p>
          <div className="space-y-4 max-w-2xl">
            {posts.map((post) => (
              <WallPostCard
                key={post.id}
                post={{
                  ...post,
                  artists: {
                    slug: artist.slug,
                    name: artist.name,
                    accent_colour: artist.accent_colour,
                    avatar_url: artist.avatar_url,
                  },
                }}
              />
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors.

- [ ] **Step 8: Commit**

```bash
git add app/[slug]/page.tsx app/[slug]/ArtistProfileClient.tsx
git commit -m "feat: wire FollowButton and Updates section into artist profile"
```

---

### Task 5: Rewire post notifications to use followers

**Files:**
- Modify: `app/api/posts/route.ts:51-71`

- [ ] **Step 1: Replace the purchases query with fan_follows query**

In `app/api/posts/route.ts`, replace lines 51-71 (the `buyers` query and notification loop) with:

```typescript
  const { data: followers } = await supabase
    .from('fan_follows')
    .select('user_id')
    .eq('artist_id', artist.id)

  if (followers && followers.length > 0) {
    const uniqueIds = [...new Set(followers.map(f => f.user_id))]
    const CHUNK = 50
    for (let i = 0; i < uniqueIds.length; i += CHUNK) {
      const chunk = uniqueIds.slice(i, i + CHUNK)
      await createNotificationBatch({
        supabase,
        userIds: chunk,
        type: 'artist_post',
        title: `${artist.name} posted an update`,
        body: content.slice(0, 100),
        link: `/${artist.slug}`,
      })
    }
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/posts/route.ts
git commit -m "feat: send post notifications to followers instead of buyers"
```

---

### Task 6: Auto-follow on purchase in Stripe webhook

**Files:**
- Modify: `supabase/functions/stripe-webhook/index.ts`

- [ ] **Step 1: Add auto-follow after single release purchase**

In `supabase/functions/stripe-webhook/index.ts`, after the founding fan badge block (around line 891, after the `catch` block that ends with `console.error('Founding fan badge failed:'...)`), add:

```typescript
      // Auto-follow artist on purchase
      if (userId) {
        await admin
          .from('fan_follows')
          .upsert(
            { user_id: userId, artist_id: artistId },
            { onConflict: 'user_id,artist_id' },
          )
          .then(() => {})
          .catch((e: Error) => console.error('Auto-follow failed:', e.message));
      }
```

- [ ] **Step 2: Add auto-follow after basket release purchase**

In the basket flow, after each release item is processed (inside the `if (item.type === 'release')` block, after the founding artist first sale RPC around line 472), add:

```typescript
            // Auto-follow artist on purchase
            if (userId) {
              await admin
                .from('fan_follows')
                .upsert(
                  { user_id: userId, artist_id: item.artist_id },
                  { onConflict: 'user_id,artist_id' },
                )
                .then(() => {})
                .catch((e: Error) => console.error('Auto-follow failed:', e.message));
            }
```

- [ ] **Step 3: Add auto-follow after basket merch purchase**

In the basket flow, inside the `else if (item.type === 'merch')` block, after the artist notification email section (around line 586), add:

```typescript
            // Auto-follow artist on merch purchase
            if (userId) {
              await admin
                .from('fan_follows')
                .upsert(
                  { user_id: userId, artist_id: item.artist_id },
                  { onConflict: 'user_id,artist_id' },
                )
                .then(() => {})
                .catch((e: Error) => console.error('Auto-follow failed:', e.message));
            }
```

- [ ] **Step 4: Add auto-follow after standalone merch purchase**

In the standalone merch flow (the `if (sessionType === 'merch')` block), after the fan email notification (around line 257), add:

```typescript
        // Auto-follow artist on merch purchase
        if (userId) {
          await admin
            .from('fan_follows')
            .upsert(
              { user_id: userId, artist_id: artistId },
              { onConflict: 'user_id,artist_id' },
            )
            .then(() => {})
            .catch((e: Error) => console.error('Auto-follow failed:', e.message));
        }
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "feat: auto-follow artist on purchase in all checkout flows"
```

---

### Task 7: Manual smoke test

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Visit an artist profile**

Navigate to an artist profile page. Verify:
- Follow button appears next to the Share button
- Follow button is hidden when viewing your own profile (if you're an artist)
- Follower count displays correctly
- Updates section shows below merch (or doesn't render if no posts)

- [ ] **Step 3: Test follow/unfollow**

Click Follow:
- Button changes to "Following" (filled orange)
- Count increments
- Hover shows "Unfollow" in red

Click again to unfollow:
- Button reverts to "Follow" (outline)
- Count decrements

- [ ] **Step 4: Test signed-out state**

Open an incognito window, visit the same artist profile:
- Follow button shows "Follow"
- Clicking shows "Sign in to follow" tooltip

- [ ] **Step 5: Test Updates section**

If the artist has posts (create one from the dashboard), verify:
- Posts render using WallPostCard styling
- Photos, text, and audio posts all display correctly
- Time ago labels are accurate
