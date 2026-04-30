import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  const admin = getAdminClient()

  // Try to read cached rates from DB
  const { data: cached } = await admin
    .from('app_cache')
    .select('value, updated_at')
    .eq('key', 'exchange_rates')
    .maybeSingle()

  if (cached) {
    const cachedAt = new Date(cached.updated_at).getTime()
    if (Date.now() - cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({
        base: 'USD',
        rates: cached.value.rates,
        cachedAt: cached.updated_at,
      })
    }
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')

    if (!res.ok) {
      if (cached) {
        return NextResponse.json({
          base: 'USD',
          rates: cached.value.rates,
          cachedAt: cached.updated_at,
          stale: true,
        })
      }
      return NextResponse.json({ error: 'Failed to fetch exchange rates' }, { status: 503 })
    }

    const data = await res.json()
    const now = new Date().toISOString()

    await admin
      .from('app_cache')
      .upsert(
        { key: 'exchange_rates', value: { rates: data.rates }, updated_at: now },
        { onConflict: 'key' },
      )

    return NextResponse.json({
      base: 'USD',
      rates: data.rates,
      cachedAt: now,
    })
  } catch {
    if (cached) {
      return NextResponse.json({
        base: 'USD',
        rates: cached.value.rates,
        cachedAt: cached.updated_at,
        stale: true,
      })
    }
    return NextResponse.json({ error: 'Exchange rate service unavailable' }, { status: 503 })
  }
}
