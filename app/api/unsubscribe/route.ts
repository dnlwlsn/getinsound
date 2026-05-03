import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function timingSafeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length)
  const paddedA = a.padEnd(maxLen, '\0')
  const paddedB = b.padEnd(maxLen, '\0')
  let result = a.length ^ b.length
  for (let i = 0; i < maxLen; i++) {
    result |= paddedA.charCodeAt(i) ^ paddedB.charCodeAt(i)
  }
  return result === 0
}

function monthBucket(offsetMonths = 0): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offsetMonths)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function generateToken(userId: string, bucket: string): Promise<string> {
  const secret = process.env.UNSUBSCRIBE_SECRET
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET is not configured')
  const data = new TextEncoder().encode(`unsubscribe:${userId}:${bucket}:${secret}`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function generateUnsubscribeToken(userId: string): Promise<string> {
  return generateToken(userId, monthBucket())
}

async function updatePreference(userId: string, unsubscribe: boolean) {
  const { error } = await getAdminClient()
    .from('fan_profiles')
    .update({ email_unsubscribed: unsubscribe })
    .eq('id', userId)

  if (error) {
    return NextResponse.json({ error: 'Failed to update preference' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const { user_id, unsubscribe, token } = await req.json()

  if (!user_id || typeof unsubscribe !== 'boolean') {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  let authorised = false

  if (token) {
    const current = await generateToken(user_id, monthBucket(0))
    const previous = await generateToken(user_id, monthBucket(-1))
    authorised = timingSafeEqual(token, current) || timingSafeEqual(token, previous)
  }

  if (!authorised) {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Ignore the body's user_id — use the authenticated user
      return updatePreference(user.id, unsubscribe)
    }
  }

  if (!authorised) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await getAdminClient()
    .from('fan_profiles')
    .update({ email_unsubscribed: unsubscribe })
    .eq('id', user_id)

  if (error) {
    return NextResponse.json({ error: 'Failed to update preference' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
