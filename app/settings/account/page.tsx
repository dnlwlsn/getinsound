import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AccountSettingsClient } from './AccountSettingsClient'

export const metadata: Metadata = {
  title: 'Account Settings | Insound',
}

export default async function AccountSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const [{ data: profile }, { data: pending }, { data: artist }] = await Promise.all([
    supabase.from('fan_profiles')
      .select('id')
      .eq('id', user.id)
      .single(),
    supabase.from('account_deletion_requests')
      .select('id, execute_at')
      .eq('user_id', user.id)
      .eq('cancelled', false)
      .eq('executed', false)
      .maybeSingle(),
    supabase.from('artists')
      .select('id')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  if (!profile) {
    await supabase.from('fan_profiles').upsert({ id: user.id }, { onConflict: 'id' })
  }

  return (
    <AccountSettingsClient
      userEmail={user.email!}
      userId={user.id}
      pendingDeletion={pending ?? null}
      isArtist={!!artist}
    />
  )
}
