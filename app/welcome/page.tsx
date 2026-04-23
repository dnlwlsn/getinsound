import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth'
import { WelcomeClient } from './WelcomeClient'

export const runtime = 'edge'
export const metadata: Metadata = {
  title: 'Welcome to Insound',
}

export default async function WelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signup')

  const role = await getUserRole(supabase, user.id)

  if (role.hasSeenWelcome && role.isArtist) redirect('/dashboard')
  if (role.hasSeenWelcome) redirect('/explore')

  return <WelcomeClient />
}
