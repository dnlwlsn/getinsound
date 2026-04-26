-- Favourites: users can save tracks or releases privately
CREATE TABLE IF NOT EXISTS public.favourites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id uuid REFERENCES public.tracks(id) ON DELETE CASCADE,
  release_id uuid REFERENCES public.releases(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT favourites_exactly_one CHECK (
    (track_id IS NOT NULL AND release_id IS NULL)
    OR (track_id IS NULL AND release_id IS NOT NULL)
  ),
  UNIQUE (user_id, track_id),
  UNIQUE (user_id, release_id)
);

CREATE INDEX IF NOT EXISTS idx_favourites_user ON public.favourites (user_id);
CREATE INDEX IF NOT EXISTS idx_favourites_track ON public.favourites (track_id) WHERE track_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_favourites_release ON public.favourites (release_id) WHERE release_id IS NOT NULL;

ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own favourites
CREATE POLICY "Users can read own favourites"
  ON public.favourites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favourites"
  ON public.favourites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favourites"
  ON public.favourites FOR DELETE
  USING (auth.uid() = user_id);

-- Aggregate views: expose counts only, never user_ids
CREATE OR REPLACE VIEW public.track_favourite_counts AS
  SELECT track_id, count(*)::int AS save_count
  FROM public.favourites
  WHERE track_id IS NOT NULL
  GROUP BY track_id;

CREATE OR REPLACE VIEW public.release_favourite_counts AS
  SELECT release_id, count(*)::int AS save_count
  FROM public.favourites
  WHERE release_id IS NOT NULL
  GROUP BY release_id;
