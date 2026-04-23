# Fan Profiles as Curated Public Shelves

**Date:** 2026-04-23
**Route:** `/@[username]` (existing, handled by `app/[slug]/page.tsx`)
**Status:** Design approved

## Overview

Upgrade the existing fan profile page from a stacked column layout into a hero + bento grid layout. Extract the monolithic `FanProfileClient.tsx` (620 lines) into focused module components. Replace native HTML5 drag-to-reorder with `@dnd-kit/sortable`. Add granular privacy controls and an explicit `fan_follows` table.

## Layout: Hero + Bento Grid

### Hero Section (full width, no card wrapper)

Merges profile header and Top 3 pinned releases into a single visual unit:
- **Left:** Avatar, username, bio, global badges, "Supporter since" label
- **Right:** 3 pinned releases in a tight row (drag-to-reorder in edit mode)
- **Mobile:** Stacks vertically (identity then Top 3)

### Bento Grid (below hero)

`grid-template-columns: repeat(3, 1fr)` with varied spans:

| Module | Span | Description |
|--------|------|-------------|
| Collection | `col-span-2` | Vinyl grid with tilt cards inside a bento card |
| Supporter Stats | `col-span-1` | Tall sidebar card beside collection |
| The Wall | `col-span-2` | Artist feed card, scrollable |
| Badge Showcase | `col-span-1` | All earned badges in a compact card |

Empty modules collapse gracefully — the grid reflows. On mobile, all cards stack to single column.

## Component Architecture

```
app/[slug]/
  FanProfileClient.tsx    → orchestrator (~100 lines), state, bento grid layout
  components/
    types.ts              → shared interfaces (FanProfile, FanBadge, etc.)
    FanHero.tsx           → avatar, identity, bio, badges + Top 3 shelf
    TopThreeShelf.tsx     → @dnd-kit sortable pinned releases (edit mode)
    VinylCollection.tsx   → collection grid wrapper
    VinylCard.tsx         → single vinyl card with tilt effect
    SupporterStats.tsx    → stats sidebar card
    BadgeShowcase.tsx     → dedicated badge display card
    TheWall.tsx           → artist posts feed
    WallPost.tsx          → single post card
```

`FanProfileClient.tsx` manages state (edit mode, pinned releases) and distributes data via props. No direct Supabase calls in child components — pin/unpin mutations stay in the parent and pass down as callbacks.

## @dnd-kit Integration

**Packages:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (~15KB gzipped total)

**Scope:** Top 3 shelf in edit mode only.

Implementation in `TopThreeShelf.tsx`:
- `DndContext` wraps the 3 pinned cards
- `SortableContext` with `horizontalListSortingStrategy`
- Each card uses `useSortable` hook for transform, transition, drag handle
- `onDragEnd` fires reorder logic (same Supabase position updates)
- `restrictToParentElement` modifier prevents dragging outside shelf
- `KeyboardSensor` + `PointerSensor` for accessibility
- Non-edit mode renders cards without DnD wrapper (zero overhead)

## Digital Vinyl Shelf

- Albums enforce `col-span-2 row-span-2` in the collection grid
- Badge overlay on hover: release-specific badges fade in over cover art
- Hidden purchases (`fan_hidden_purchases`) filtered out in the server query for non-owners

## Privacy Controls

### Existing
- `is_public` (boolean) — gates entire profile visibility
- `show_purchase_amounts` (boolean) — toggles price display

### New columns on `fan_profiles`
- `show_collection` (boolean, default `true`) — hides full collection while keeping Top 3 and badges visible
- `show_wall` (boolean, default `true`) — hides The Wall section

These are secondary controls within a public profile. Settings page (`/settings/profile`) gets two new toggles. `FanProfileClient` conditionally renders Collection and Wall modules based on these booleans.

## Schema Changes

**Migration: `0028_fan_profile_shelves.sql`**

### New columns
```sql
ALTER TABLE fan_profiles
  ADD COLUMN show_collection boolean NOT NULL DEFAULT true,
  ADD COLUMN show_wall boolean NOT NULL DEFAULT true;
```

### New table: `fan_follows`
```sql
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
```

### Backfill follows from purchases
```sql
INSERT INTO fan_follows (user_id, artist_id)
SELECT DISTINCT p.buyer_user_id, p.artist_id
FROM purchases p
WHERE p.status = 'paid'
ON CONFLICT DO NOTHING;
```

### No changes to existing tables
`fan_pinned_releases`, `fan_badges`, `fan_hidden_purchases`, `artist_posts` remain unchanged.

## SSR & SEO

The server component (`app/[slug]/page.tsx`) continues to fetch all data and pass props to `FanProfileClient`.

- **`generateMetadata`:** Fan branch returns `title: "${username}'s Collection | Insound"`, description from bio or fallback, `openGraph.images` from avatar
- **Public profiles:** Full SSR, all data in initial HTML
- **Private profiles:** 404 for non-owners (existing behavior)
- **Structured data:** `Person` JSON-LD with name, image, `interactionStatistic` for collection size

## The Wall Integration

- Query changes from purchase-derived artists to `fan_follows` join
- Backfill migration ensures existing users see no change
- Follow button on artist profiles out of scope (schema enables it for future)
- Wall bento card: `col-span-2`, max height with scroll

## Existing Code Preserved

The following stay unchanged:
- `resolveAccent()` color logic
- `useCurrency()` provider for price formatting
- `BadgeList` component from `app/components/ui/Badge.tsx`
- Nav bar structure (fixed, blurred background)
- Private profile banner for owners
- Footer
- VinylCard tilt effect (perspective + rotateY/rotateX on mousemove)
