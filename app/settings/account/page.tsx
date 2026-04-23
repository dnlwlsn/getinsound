import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AccountSettingsClient } from './AccountSettingsClient'

export const runtime = 'edge'
export const metadata: Metadata = {
  title: 'Account Settings | Insound',
}

export default async function AccountSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signup')

  const { data: profile } = await supabase
    .from('fan_profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/welcome')

  const { data: pending } = await supabase
    .from('account_deletion_requests')
    .select('id, execute_at')
    .eq('user_id', user.id)
    .eq('cancelled', false)
    .eq('executed', false)
    .maybeSingle()

  return (
    <AccountSettingsClient
      userEmail={user.email!}
      userId={user.id}
      pendingDeletion={pending ?? null}
    />
  )
}
