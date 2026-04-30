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

  const since = new Date()
  since.setDate(since.getDate() - 30)

  const { data: purchases } = await supabase
    .from('purchases')
    .select('amount_pence, platform_pence, paid_at')
    .eq('status', 'paid')
    .gte('paid_at', since.toISOString())
    .order('paid_at', { ascending: true })

  const dayMap = new Map<string, { revenue: number; platform: number; count: number }>()

  for (let i = 0; i < 30; i++) {
    const d = new Date()
    d.setDate(d.getDate() - 29 + i)
    const key = d.toISOString().slice(0, 10)
    dayMap.set(key, { revenue: 0, platform: 0, count: 0 })
  }

  for (const p of purchases ?? []) {
    if (!p.paid_at) continue
    const key = p.paid_at.slice(0, 10)
    const day = dayMap.get(key)
    if (day) {
      day.revenue += p.amount_pence
      day.platform += p.platform_pence
      day.count++
    }
  }

  const days = [...dayMap.entries()].map(([date, data]) => ({
    date,
    revenue: data.revenue,
    platform: data.platform,
    count: data.count,
  }))

  return NextResponse.json({ days })
}
