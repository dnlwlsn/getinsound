-- Fan wishlist table
CREATE TABLE IF NOT EXISTS public.fan_wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, release_id)
);

CREATE INDEX IF NOT EXISTS idx_fan_wishlist_user ON public.fan_wishlist (user_id);
CREATE INDEX IF NOT EXISTS idx_fan_wishlist_release ON public.fan_wishlist (release_id);

ALTER TABLE public.fan_wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own wishlist"
  ON public.fan_wishlist FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
