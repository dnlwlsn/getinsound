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
  if (!user) redirect('/signup?intent=artist')

  const role = await getUserRole(supabase, user.id)
  if (role.isArtist) redirect('/dashboard')

  return <BecomeArtistClient userEmail={user.email ?? ''} />
}
