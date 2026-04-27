# Follow Button + Artist Posts Wiring — Design Spec

**Date:** 2026-04-27

## Overview

Add a Follow button to artist profiles, wire up auto-follow on purchase, rewire post notifications to use followers, add an Updates section to artist profiles showing recent posts, and notify artists when they gain a new follower.

Posts remain public (no gating behind follow). The PostComposer stays in the dashboard only.

## 1. Follow Button

### Placement

Artist profile header (`ArtistProfileClient.tsx`), next to the existing Share button. Hidden when the viewer is the artist themselves.

### States

| State | Label | Style |
|-------|-------|-------|
| Signed out | "Follow" | Orange outline pill. Click prompts sign-in. |
| Not following | "Follow" | Orange outline pill. |
| Following | "Following" | Filled orange pill. Hover shows "Unfollow" with red/zinc colour. |
| Loading | Disabled | Reduced opacity during API call. |

### Follower Count

Displayed near the artist name, e.g. "42 followers". Count fetched server-side via `fan_follows` count query in `app/[slug]/page.tsx`.

### Component

New file: `app/components/ui/FollowButton.tsx`. Follows the same pattern as `FavouriteButton` — hydrates user state on mount, optimistic toggle, error rollback.

### API

New file: `app/api/follows/route.ts`

- `POST` — follow. Body: `{ artist_id }`. Inserts into `fan_follows`. Returns 200. Sends in-app notification to the artist.
- `DELETE` — unfollow. Body: `{ artist_id }`. Deletes from `fan_follows`. Returns 200.

Both require authentication. Cannot follow yourself.

## 2. Notifications + Auto-Follow

### New follower notification

When a fan follows an artist, the artist receives an in-app notification: "{fan_name} started following you" (or "A new fan followed you" if no public profile). No email by default.

New notification type: `'new_follower'` added to the notification system.

### Auto-follow on purchase

In the Stripe webhook (`supabase/functions/stripe-webhook/index.ts`), after creating a purchase, upsert into `fan_follows` with `ON CONFLICT DO NOTHING`. Covers future purchases. Existing purchases were backfilled by migration `0028_fan_profile_shelves.sql`.

### Post notifications rewired

In `/api/posts/route.ts`, change the recipient query from `purchases` (buyer_user_id) to `fan_follows` (user_id) for the artist. Since all buyers auto-follow, no one loses notifications. Simplifies the query.

## 3. Updates Section on Artist Profile

### Placement

Below merch (or below releases if no merch), above the page footer. Commercial content stays higher.

### Content

Latest 10 posts from the artist, rendered using the existing `WallPostCard` component. "Show more" button expands inline to load older posts.

### Data

Fetched server-side in `app/[slug]/page.tsx` — select from `artist_posts` where `artist_id` matches, ordered by `created_at` desc, limit 10. Passed to `ArtistProfileClient` as a prop.

### Empty state

If the artist has no posts, the Updates section is not rendered at all.

## 4. Existing Infrastructure (No Changes)

- `fan_follows` table — already exists with RLS and indexes
- `artist_posts` table — already exists with text/photo/demo/voice_note types
- `PostComposer` component — stays in dashboard only
- `TheWall` + `WallPostCard` — reused for Updates section on artist profile
- Notification system — already supports batch sending and preferences

## 5. Files Changed

| File | Change |
|------|--------|
| `app/components/ui/FollowButton.tsx` | New — follow/unfollow toggle button |
| `app/api/follows/route.ts` | New — POST/DELETE follow endpoints |
| `app/[slug]/page.tsx` | Fetch follower count + artist posts server-side |
| `app/[slug]/ArtistProfileClient.tsx` | Add FollowButton to header, Updates section below merch |
| `app/api/posts/route.ts` | Rewire notification recipients from purchases to fan_follows |
| `supabase/functions/stripe-webhook/index.ts` | Add auto-follow upsert after purchase |
| `lib/notifications.ts` | Add `'new_follower'` to notification types |
