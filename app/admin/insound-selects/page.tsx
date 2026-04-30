import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import InsoundSelectsClient from './InsoundSelectsClient'

export const metadata: Metadata = {
  title: 'Insound Selects — Admin',
}

export default async function InsoundSelectsPage() {
  const supabase = await createClient()

  const [artistsRes, featuredRes] = await Promise.all([
    supabase.from('artists').select('id, slug, name, avatar_url').order('name'),
    supabase
      .from('featured_artists')
      .select('id, artist_id, week_of, editorial_note, artists!inner ( name )')
      .order('week_of', { ascending: false })
      .limit(10),
  ])

  return (
    <InsoundSelectsClient
      artists={artistsRes.data ?? []}
      history={featuredRes.data ?? []}
    />
  )
}
