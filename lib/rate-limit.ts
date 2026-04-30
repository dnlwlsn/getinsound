import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Action = 'magic_link' | 'purchase' | 'signup' | 'redeem_code' | 'social_verify' | 'email_change' | 'search' | 'log_play' | 'newsletter' | 'general'

export async function checkRateLimit(
  key: string,
  action: Action,
  max: number,
  windowHours: number,
): Promise<NextResponse | null> {
  const supabase = await createClient()
  const { data: allowed } = await supabase.rpc('check_rate_limit', {
    p_key: key,
    p_action: action,
    p_max: max,
    p_window: `${windowHours} hours`,
  })

  if (allowed === false) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(windowHours * 3600) } },
    )
  }

  return null
}

export function getClientIp(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

export async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}
