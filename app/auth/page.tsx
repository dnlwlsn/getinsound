import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthClient from './AuthClient'

export const runtime = 'edge'
export const metadata: Metadata = {
  title: 'Sign In | Insound',
}

export default async function AuthPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/welcome')

  return <AuthClient />
}
