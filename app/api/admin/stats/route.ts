import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'
function getTimeFilter(period: string): string | null {
  const now = new Date()
  switch (period) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    case 'week': {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return d.toISOString()
    }
    case 'month': {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 1)
      return d.toISOString()
    }
    default:
      return null
  }
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const period = req.nextUrl.searchParams.get('period') ?? 'all'
  const since = getTimeFilter(period)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  let artistQ = supabase.from('artists').select('id', { count: 'exact', head: true })
  let fanQ = supabase.from('fan_profiles').select('id', { count: 'exact', head: true })
  let releaseQ = supabase.from('releases').select('id', { count: 'exact', head: true }).eq('published', true)
  let waitlistQ = supabase.from('waitlist').select('id', { count: 'exact', head: true })

  if (since) {
    artistQ = artistQ.gte('created_at', since)
    fanQ = fanQ.gte('created_at', since)
    releaseQ = releaseQ.gte('created_at', since)
    waitlistQ = waitlistQ.gte('created_at', since)
  }

  const purchaseAggQ = supabase.rpc('admin_purchase_stats', { since_ts: since })

  const preorderQ = supabase
    .from('purchases')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'paid')
    .eq('pre_order', true)

  const [
    { count: artistCount },
    { count: fanCount },
    { count: releaseCount },
    { count: waitlistCount },
    { data: purchaseAgg },
    { count: preorderCount },
  ] = await Promise.all([artistQ, fanQ, releaseQ, waitlistQ, purchaseAggQ, preorderQ])

  const agg = purchaseAgg?.[0] ?? purchaseAgg ?? {
    total_sales: 0,
    total_revenue: 0,
    artist_received: 0,
    platform_revenue: 0,
    stripe_fees: 0,
  }

  const waitlist = waitlistCount ?? 0

  return NextResponse.json({
    artists: artistCount ?? 0,
    fans: fanCount ?? 0,
    releases: releaseCount ?? 0,
    totalSales: Number(agg.total_sales) || 0,
    totalRevenue: Number(agg.total_revenue) || 0,
    artistEarnings: Number(agg.artist_received) || 0,
    insoundRevenue: Number(agg.platform_revenue) || 0,
    stripeFees: Number(agg.stripe_fees) || 0,
    activePreOrders: preorderCount ?? 0,
    merchPending: 0,
    waitlist,
    waitlistRemaining: Math.max(0, 50 - waitlist),
  })
}
