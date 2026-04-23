import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rate-limit'

export const runtime = 'edge'
export async function POST(request: NextRequest) {
  const refCode = request.cookies.get('insound_ref')?.value
  if (!refCode) return NextResponse.json({ ok: true })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('fan_profiles')
    .select('referred_by, referral_code')
    .eq('id', user.id)
    .single()

  if (!profile || profile.referred_by) {
    return NextResponse.json({ ok: true })
  }

  if (profile.referral_code === refCode) {
    return NextResponse.json({ ok: true })
  }

  const ip = getClientIp(request.headers)
  const ipHash = await hashIp(ip)
  const rateLimited = await checkRateLimit(ipHash, 'signup', 5, 1)
  if (rateLimited) {
    const response = NextResponse.json({ ok: true })
    response.cookies.delete('insound_ref')
    return response
  }

  const { data: justUnlocked } = await supabase.rpc('record_referral', {
    referrer_code: refCode,
    new_user_id: user.id,
  })

  if (justUnlocked) {
    const { data: referrer } = await supabase
      .from('fan_profiles')
      .select('id')
      .eq('referral_code', refCode)
      .single()

    if (referrer) {
      await supabase.functions.invoke('notify-referral-unlock', {
        body: { user_id: referrer.id },
      })
    }
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.delete('insound_ref')
  return response
}
