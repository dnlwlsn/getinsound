import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardSettingsClient } from './DashboardSettingsClient'

export const metadata = { title: 'Account Settings | Insound' }

export default async function DashboardSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signup')

  const [artistRes, accountRes, pendingRes] = await Promise.all([
    supabase.from('artists').select('id, name').eq('id', user.id).maybeSingle(),
    supabase.from('artist_accounts').select('stripe_account_id, stripe_onboarded').eq('id', user.id).maybeSingle(),
    supabase
      .from('account_deletion_requests')
      .select('id, execute_at')
      .eq('user_id', user.id)
      .eq('cancelled', false)
      .eq('executed', false)
      .maybeSingle(),
  ])

  if (!artistRes.data || !accountRes.data) redirect('/become-an-artist')

  const [releasesRes, salesRes, preordersRes] = await Promise.all([
    supabase.from('releases').select('id', { count: 'exact', head: true }).eq('artist_id', user.id),
    supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('artist_id', user.id).eq('status', 'paid'),
    supabase
      .from('purchases')
      .select('id, releases!inner(preorder_enabled, cancelled)', { count: 'exact', head: true })
      .eq('artist_id', user.id)
      .eq('status', 'paid')
      .eq('pre_order', true)
      .eq('releases.preorder_enabled', true)
      .eq('releases.cancelled', false),
  ])

  return (
    <DashboardSettingsClient
      userEmail={user.email!}
      userId={user.id}
      artistName={artistRes.data.name}
      stripeConnected={accountRes.data.stripe_onboarded}
      stripeAccountId={accountRes.data.stripe_account_id}
      pendingDeletion={pendingRes.data ?? null}
      impact={{
        releaseCount: releasesRes.count ?? 0,
        totalSales: salesRes.count ?? 0,
        activePreorders: preordersRes.count ?? 0,
      }}
    />
  )
}
