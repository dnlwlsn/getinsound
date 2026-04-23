import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ShareClient } from './ShareClient'

export const runtime = 'edge'
export const metadata = { title: "You're in | Insound" }

export default async function SharePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signup')

  const { data: profile } = await supabase
    .from('fan_profiles')
    .select('referral_code, referral_count, first_year_zero_fees')
    .eq('id', user.id)
    .single()

  if (!profile?.referral_code) redirect('/welcome')

  return (
    <ShareClient
      referralCode={profile.referral_code}
      referralCount={profile.referral_count}
      zeroFeesUnlocked={profile.first_year_zero_fees}
    />
  )
}
