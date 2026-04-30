import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const [{ data: signups }, { data: purchases }, { data: releases }] = await Promise.all([
    supabase.from('fan_profiles')
      .select('id, username, avatar_url, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('purchases')
      .select('id, amount_pence, created_at, releases(title), artists(name)')
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('releases')
      .select('id, title, created_at, artists!inner(name)')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const events: { id: string; type: string; text: string; time: string }[] = []

  for (const s of signups ?? []) {
    events.push({
      id: `signup-${s.id}`,
      type: 'signup',
      text: `${s.username || 'New user'} signed up`,
      time: s.created_at,
    })
  }

  for (const p of purchases ?? []) {
    const release = p.releases as unknown as { title: string } | null
    const artist = p.artists as unknown as { name: string } | null
    events.push({
      id: `purchase-${p.id}`,
      type: 'purchase',
      text: `${release?.title ?? 'Unknown'} by ${artist?.name ?? 'Unknown'} sold for £${(p.amount_pence / 100).toFixed(2)}`,
      time: p.created_at,
    })
  }

  for (const r of releases ?? []) {
    const artist = r.artists as unknown as { name: string }
    events.push({
      id: `release-${r.id}`,
      type: 'release',
      text: `${artist.name} published ${r.title}`,
      time: r.created_at,
    })
  }

  events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  return NextResponse.json({ events: events.slice(0, 20) })
}
