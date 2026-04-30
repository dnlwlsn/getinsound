import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers)
  const ipHash = await hashIp(ip)
  const rateLimited = await checkRateLimit(ipHash, 'newsletter', 5, 1)
  if (rateLimited) return rateLimited

  const body = await request.json().catch(() => null)
  const email = body?.email?.trim()?.toLowerCase()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('newsletter_subscribers')
    .insert({ email, user_id: user?.id ?? null, source: 'homepage' })

  if (error?.code === '23505') {
    return NextResponse.json({ ok: true })
  }

  if (error) {
    console.error('Newsletter subscribe error:', error)
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
