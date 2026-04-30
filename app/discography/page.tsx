import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DiscographyClient } from './DiscographyClient'


export const metadata = { title: 'My Discography | Insound' }

export default async function DiscographyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: artist } = await supabase
    .from('artists')
    .select('id, slug, name')
    .eq('id', user.id)
    .maybeSingle()

  if (!artist) redirect('/auth')

  const [{ data: account }, { data: releases }] = await Promise.all([
    supabase.from('artist_accounts')
      .select('stripe_onboarded')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.from('releases')
      .select('id, slug, title, type, cover_url, price_pence, published, pwyw_enabled, pwyw_minimum_pence, preorder_enabled, release_date, visibility, created_at, tracks(id, title, position, duration_sec, audio_path, preview_path)')
      .eq('artist_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <DiscographyClient
      artist={artist}
      stripeOnboarded={account?.stripe_onboarded ?? false}
      releases={(releases || []).map(r => ({
        ...r,
        tracks: [...(r.tracks || [])].sort((a, b) => a.position - b.position),
      }))}
    />
  )
}
