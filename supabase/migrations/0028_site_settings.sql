-- Feature flags / site settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT 'false',
  description text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

-- RLS: anyone can read, only admins can write (enforced at app level via service role)
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site_settings"
  ON public.site_settings FOR SELECT
  USING (true);

-- Seed initial feature flags
INSERT INTO public.site_settings (key, value, description) VALUES
  ('merch_enabled', 'false', 'Show merch features across the platform'),
  ('download_codes_enabled', 'true', 'Allow artists to generate download codes'),
  ('pre_orders_enabled', 'true', 'Allow pre-order purchases'),
  ('referral_system_enabled', 'true', 'Enable the fan referral system'),
  ('public_fan_profiles_enabled', 'true', 'Allow fans to make profiles public'),
  ('artist_posts_enabled', 'true', 'Allow artists to create wall posts')
ON CONFLICT (key) DO NOTHING;
