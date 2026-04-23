# Search Feature Design Spec

## Overview

Full-text search for Insound covering artists and releases. Two entry points: a global NavBar search with instant dropdown results, and a dedicated `/search?q=` results page. Powered by Postgres tsvector/tsquery with GIN indexes, served via a Next.js API route.

## Architecture

```
NavBar input (debounced 300ms)
        │
        ▼
  /api/search?q=...&limit=6    ← dropdown (top 3 artists + top 3 releases)
  /api/search?q=...            ← full results page (no limit)
        │
        ▼
  supabase.rpc('search_artists', { query })
  supabase.rpc('search_releases', { query })
        │
        ▼
  tsvector columns + GIN indexes on artists/releases
        │
        ▼
  Insert into search_logs (fire-and-forget, non-blocking)
```

Single API route handles both use cases. The `limit` param distinguishes dropdown (3+3) from full page (all results).

## Database Changes (new migration: `0018_search.sql`)

### 1. tsvector columns

```sql
-- Artists: search on name and bio
alter table public.artists
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(bio, '')), 'B')
  ) stored;

create index artists_search_idx on public.artists using gin(search_vector);

-- Releases: search on title and genre, with type-based ranking boost
alter table public.releases
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(genre, '')), 'B')
  ) stored;

create index releases_search_idx on public.releases using gin(search_vector);
```

### 2. Search RPC functions

```sql
-- search_artists: returns matching artists ordered by relevance
create or replace function public.search_artists(
  query text,
  max_results integer default 50
)
returns table (
  id uuid,
  slug text,
  name text,
  avatar_url text,
  bio text,
  release_count bigint,
  rank real
)
language sql stable
as $$
  select
    a.id, a.slug, a.name, a.avatar_url, a.bio,
    (select count(*) from public.releases r
     where r.artist_id = a.id and r.published = true) as release_count,
    ts_rank(a.search_vector, websearch_to_tsquery('english', query)) as rank
  from public.artists a
  where a.search_vector @@ websearch_to_tsquery('english', query)
  order by rank desc
  limit max_results;
$$;

-- search_releases: returns matching published releases, albums/EPs ranked above singles
create or replace function public.search_releases(
  query text,
  max_results integer default 50
)
returns table (
  id uuid,
  slug text,
  title text,
  type text,
  cover_url text,
  genre text,
  price_pence integer,
  currency text,
  artist_id uuid,
  artist_name text,
  artist_slug text,
  rank real
)
language sql stable
as $$
  select
    r.id, r.slug, r.title, r.type, r.cover_url, r.genre,
    r.price_pence, r.currency,
    a.id as artist_id, a.name as artist_name, a.slug as artist_slug,
    ts_rank(r.search_vector, websearch_to_tsquery('english', query))
      * case r.type when 'album' then 1.3 when 'ep' then 1.15 else 1.0 end
      as rank
  from public.releases r
  join public.artists a on a.id = r.artist_id
  where r.published = true
    and r.search_vector @@ websearch_to_tsquery('english', query)
  order by rank desc
  limit max_results;
$$;
```

Key decisions:
- `websearch_to_tsquery` for natural query parsing (handles "and", "or", quotes, negation)
- Albums get 1.3x rank boost, EPs get 1.15x — singles rank naturally
- Only published releases returned (unpublished/unlisted excluded)
- Both functions take `max_results` param for dropdown vs full page

### 3. Fuzzy fallback

When tsquery returns zero results, fall back to trigram similarity for typo tolerance:

```sql
create extension if not exists pg_trgm;

create index artists_name_trgm_idx on public.artists using gin(name gin_trgm_ops);
create index releases_title_trgm_idx on public.releases using gin(title gin_trgm_ops);
```

The API route handles the fallback logic: try FTS first, if zero results, run a trigram similarity query.

### 4. search_logs table

```sql
create table public.search_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id),
  query         text not null,
  results_count integer not null default 0,
  created_at    timestamptz not null default now()
);

create index search_logs_created_idx on public.search_logs(created_at desc);

alter table public.search_logs enable row level security;
-- No RLS policies = service_role only (logged server-side)
```

## API Route: `/api/search`

**File:** `app/api/search/route.ts`

```
GET /api/search?q=<query>&limit=<number>
```

- `q`: search query string (required, min 1 char after trim)
- `limit`: optional, caps results per section. Dropdown sends `limit=3`.
- Returns `{ artists: [...], releases: [...] }`
- Empty `q` returns `{ artists: [], releases: [] }`
- Uses server Supabase client (service_role not needed — RPC uses anon-safe queries)
- Inserts into `search_logs` via a non-blocking `.then()` after response
- If FTS returns 0 total results, retries with trigram similarity

Response shape:
```json
{
  "artists": [
    { "id": "...", "slug": "...", "name": "...", "avatar_url": "...", "bio": "..." }
  ],
  "releases": [
    {
      "id": "...", "slug": "...", "title": "...", "type": "...",
      "cover_url": "...", "genre": "...", "price_pence": 999,
      "currency": "GBP", "artist_name": "...", "artist_slug": "..."
    }
  ]
}
```

## NavBar Search Component

**Location:** Integrated into `app/components/ui/NavBar.tsx`

### Desktop (md+)
- Persistent search input field in the NavBar, between links and CTA
- Placeholder: "Search artists, releases, genres..."
- Styled: `bg-zinc-900 ring-1 ring-white/[0.06] focus:ring-orange-600` (matches existing input patterns)
- Width: `w-64` expanding to `w-80` on focus (smooth transition)

### Mobile (<md)
- Search icon button in NavBar (magnifying glass)
- Tap expands a full-width input below the NavBar (slide-down animation)
- Close button (X) to collapse

### Dropdown
- Appears below input after 300ms debounce, min 2 chars
- Calls `/api/search?q=...&limit=3`
- Sections: "Artists" (up to 3 ArtistCard-style rows), "Releases" (up to 3 release rows with cover thumbnail)
- Each row links to the artist/release page
- "View all results" link at bottom → navigates to `/search?q=...`
- Enter key → navigates to `/search?q=...`
- Click outside or Escape → closes dropdown
- Loading state: subtle spinner
- No results: "No results for '[query]'"
- Styled with existing card patterns: `bg-zinc-950 ring-1 ring-white/[0.06] rounded-xl`

### Component structure
- `SearchInput` — the input + dropdown wrapper (client component)
- NavBar accepts it as a new optional `search` prop (keeps NavBar flexible)

## Search Results Page

**Route:** `app/search/page.tsx` (server component) + `app/search/SearchClient.tsx` (client component)

### Server component
- Reads `searchParams.q`
- Calls `/api/search` internally (or directly via Supabase RPC from server)
- Passes results to SearchClient

### Client component (`SearchClient.tsx`)
- Receives initial results as props
- Search input at top (pre-filled with query, updates URL on Enter)
- Two sections:

**Artists section:**
- Heading: "Artists" with result count
- Grid of ArtistCard components (reuse existing `ArtistCard.tsx`)
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (artists are wider cards)
- Each card links to `/${artist.slug}`

**Releases section:**
- Heading: "Releases" with result count
- Respects ViewToggle (expanded grid / compact list)
- Grid matches ExploreClient pattern: `grid-cols-2 md:grid-cols-4 lg:grid-cols-5`
- Each release card shows: cover, title, artist name, type badge, price
- Links to `/${artist_slug}/${release_slug}` (or however release pages are routed)
- Uses `useCurrency()` for price formatting

**Empty state:**
- "No results for '[query]'." centered, muted text
- Suggestion: "Try a different search term"

**No query state:**
- If someone lands on `/search` with no `q`, show the search input with focus and a prompt

### Styling
- Consistent with existing pages: `max-w-6xl mx-auto`, Montserrat, dark theme
- Section headings: `text-xs font-black uppercase tracking-widest text-zinc-500`
- Light theme support via existing `[html[data-theme=light]_&]:` pattern

## ArtistCard Enhancement

The existing `ArtistCard` needs a `slug` or `href` prop so it can link to the artist profile. Currently it takes `avatar`, `name`, `genre`, `releaseCount`. For search, we need it to be clickable. Options:

- Wrap it in a `Link` from the search results page (no ArtistCard changes needed)
- Add an optional `href` prop

Recommendation: wrap in `Link` from the consumer — keeps ArtistCard generic.

Note: ArtistCard takes `genre` and `releaseCount`, but the search RPC returns `bio` and `release_count` instead (no genre on artists table). For the full results page, pass `release_count` from the RPC and leave `genre` empty or omit it. The dropdown uses a simpler row rendering (avatar + name + bio snippet, no ArtistCard).

## File Structure

```
app/
  api/search/route.ts              — GET handler
  search/
    page.tsx                        — server component (reads query, fetches)
    SearchClient.tsx                — client component (renders results)
  components/ui/
    SearchInput.tsx                 — NavBar search input + dropdown (client)
    NavBar.tsx                      — updated to accept search prop
supabase/
  migrations/
    0018_search.sql                 — tsvector, GIN indexes, RPCs, search_logs
```

## Edge Cases

- **Empty query**: return empty results, no log entry
- **Very long query**: truncate to 200 chars server-side
- **Special characters**: `websearch_to_tsquery` handles these safely
- **No results from FTS**: fall back to trigram similarity on name/title
- **Concurrent dropdown requests**: abort previous fetch on new keystroke (AbortController)
- **XSS in query display**: React's JSX escaping handles this, but ensure the "No results for '...'" display uses text content, not dangerouslySetInnerHTML
- **URL encoding**: `q` param properly encoded/decoded via URLSearchParams

## Out of Scope

- Search suggestions / autocomplete (future enhancement)
- Search history for logged-in users
- Trending searches
- Track-level search (only artists and releases)
- Algolia/Typesense (Postgres FTS is sufficient at current scale)
