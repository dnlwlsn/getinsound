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

async function generateToken(userId: string): Promise<string> {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY!
  const data = new TextEncoder().encode(`unsubscribe:${userId}:${secret}`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function generateUnsubscribeToken(userId: string): Promise<string> {
  return generateToken(userId)
}

export async function POST(req: NextRequest) {
  const { user_id, unsubscribe, token } = await req.json()

  if (!user_id || typeof unsubscribe !== 'boolean') {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  let authorised = false

  if (token) {
    const expected = await generateToken(user_id)
    authorised = timingSafeEqual(token, expected)
  }

  if (!authorised) {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user && user.id === user_id) authorised = true
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
