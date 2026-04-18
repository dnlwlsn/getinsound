import { SupabaseClient } from '@supabase/supabase-js'

export type UserRole = {
  isArtist: boolean
  artistSlug: string | null
  hasSeenWelcome: boolean
}

export async function getUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<UserRole> {
  const [artistRes, profileRes] = await Promise.all([
    supabase
      .from('artists')
      .select('slug')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('fan_profiles')
      .select('has_seen_welcome')
      .eq('id', userId)
      .maybeSingle(),
  ])

  return {
    isArtist: !!artistRes.data,
    artistSlug: artistRes.data?.slug ?? null,
    hasSeenWelcome: profileRes.data?.has_seen_welcome ?? false,
  }
}
