import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InsoundSelectsClient from './InsoundSelectsClient'


export const metadata: Metadata = {
  title: 'Insound Selects — Admin',
}

const ADMIN_EMAILS = [
  'dvnielwilson@gmail.com',
]

export default async function InsoundSelectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signup')

  const { data: account } = await supabase
    .from('artist_accounts')
    .select('email')
    .eq('id', user.id)
    .maybeSingle()

  if (!account || !ADMIN_EMAILS.includes(account.email)) {
    redirect('/')
  }

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
