import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileSettingsClient } from './ProfileSettingsClient'

export const metadata: Metadata = {
  title: 'Profile Settings | Insound',
}

export default async function ProfileSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signup')

  const { data: profile } = await supabase
    .from('fan_profiles')
    .select('username, avatar_url, bio, accent_colour, is_public, show_purchase_amounts')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/welcome')

  // Fetch purchases for the "hide specific purchases" list
  const { data: purchases } = await supabase
    .from('purchases')
    .select('id, amount_pence, paid_at, releases (title, type), artists (name)')
    .eq('buyer_user_id', user.id)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })

  // Fetch currently hidden purchases
  const { data: hidden } = await supabase
    .from('fan_hidden_purchases')
    .select('purchase_id')
    .eq('user_id', user.id)

  const hiddenIds = new Set((hidden || []).map(h => h.purchase_id))

  return (
    <ProfileSettingsClient
      profile={profile}
      purchases={(purchases || []) as any}
      hiddenPurchaseIds={[...hiddenIds]}
    />
  )
}
