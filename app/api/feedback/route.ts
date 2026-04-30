import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rate-limit'

const VALID_CATEGORIES = ['bug', 'feature_request', 'general'] as const

export async function POST(req: Request) {
  const ip = getClientIp(req.headers)
  const ipHash = await hashIp(ip)
  const limited = await checkRateLimit(ipHash, 'general', 10, 1)
  if (limited) return limited

  const body = await req.json()
  const { category, message, pageUrl } = body

  if (!VALID_CATEGORIES.includes(category) || !message?.trim()) {
    return NextResponse.json({ error: 'Invalid feedback' }, { status: 400 })
  }

  if (message.trim().length > 2000) {
    return NextResponse.json({ error: 'Message too long' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('user_feedback').insert({
    user_id: user?.id ?? null,
    category,
    message: message.trim(),
    page_url: pageUrl || null,
  })

  if (error) {
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
