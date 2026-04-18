import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignupClient } from './SignupClient'

export const metadata: Metadata = {
  title: 'Join Insound',
  description: 'Sign up to Insound — the music platform that pays artists.',
}

export default async function SignupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/welcome')

  return <SignupClient />
}
