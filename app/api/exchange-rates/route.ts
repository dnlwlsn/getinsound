import { NextResponse } from 'next/server'

interface CachedRates {
  rates: Record<string, number>
  cachedAt: number
}

let cache: CachedRates | null = null
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

export async function GET() {
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      base: 'USD',
      rates: cache.rates,
      cachedAt: new Date(cache.cachedAt).toISOString(),
    })
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      if (cache) {
        return NextResponse.json({
          base: 'USD',
          rates: cache.rates,
          cachedAt: new Date(cache.cachedAt).toISOString(),
          stale: true,
        })
      }
      return NextResponse.json({ error: 'Failed to fetch exchange rates' }, { status: 503 })
    }

    const data = await res.json()
    cache = { rates: data.rates, cachedAt: Date.now() }

    return NextResponse.json({
      base: 'USD',
      rates: data.rates,
      cachedAt: new Date(cache.cachedAt).toISOString(),
    })
  } catch {
    if (cache) {
      return NextResponse.json({
        base: 'USD',
        rates: cache.rates,
        cachedAt: new Date(cache.cachedAt).toISOString(),
        stale: true,
      })
    }
    return NextResponse.json({ error: 'Exchange rate service unavailable' }, { status: 503 })
  }
}
