-- Add is_admin flag to fan_profiles
ALTER TABLE public.fan_profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Index for quick admin lookups
CREATE INDEX IF NOT EXISTS idx_fan_profiles_is_admin ON public.fan_profiles (id) WHERE is_admin = true;
