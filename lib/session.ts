import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export function parseDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device'

  let browser = 'Unknown browser'
  if (userAgent.includes('Firefox/')) browser = 'Firefox'
  else if (userAgent.includes('Edg/')) browser = 'Edge'
  else if (userAgent.includes('Chrome/')) browser = 'Chrome'
  else if (userAgent.includes('Safari/')) browser = 'Safari'

  let os = ''
  if (userAgent.includes('Mac OS')) os = 'macOS'
  else if (userAgent.includes('Windows')) os = 'Windows'
  else if (userAgent.includes('Linux')) os = 'Linux'
  else if (userAgent.includes('Android')) os = 'Android'
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS'

  return os ? `${browser} on ${os}` : browser
}

export function maskIp(ip: string): string {
  const parts = ip.split('.')
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`
  const v6parts = ip.split(':')
  if (v6parts.length > 2) return `${v6parts[0]}:${v6parts[1]}:x:x`
  return 'x.x.x.x'
}

export async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function createSession(
  userId: string,
  headers: Headers,
): Promise<{ sessionId: string } | null> {
  const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = headers.get('user-agent')
  const country = headers.get('cf-ipcountry')
  const city = headers.get('cf-ipcity')

  const { data, error } = await getAdminClient()
    .from('user_sessions')
    .insert({
      user_id: userId,
      device: parseDevice(userAgent),
      ip_hash: await hashIp(ip),
      ip_display: maskIp(ip),
      city: city || null,
      country: (country && country !== 'XX' && country !== 'T1') ? country : null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to create session:', error.message)
    return null
  }

  return { sessionId: data.id }
}

export function setSessionCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set('session_id', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}
