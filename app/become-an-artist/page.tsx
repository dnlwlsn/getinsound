import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth'
import { BecomeArtistClient } from './BecomeArtistClient'

export const metadata: Metadata = {
  title: 'Become an Artist | Insound',
  description: 'Start selling your music on Insound.',
}

export default async function BecomeArtistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?mode=signup&intent=artist')

  if (!user.email_confirmed_at) {
    redirect('/settings/account?verify=artist')
  }

  const role = await getUserRole(supabase, user.id)
  if (role.isArtist) {
    const { data: account } = await supabase
      .from('artist_accounts')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()
    if (account) redirect('/dashboard')
    // Orphaned artists row with no artist_accounts — clean up so user can retry
    await supabase.from('artists').delete().eq('id', user.id)
  }

  return <BecomeArtistClient userEmail={user.email ?? ''} />
}
