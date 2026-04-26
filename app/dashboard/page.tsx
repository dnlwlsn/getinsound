import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './DashboardClient'

export const metadata = { title: 'Artist Studio | Insound' }

export default async function DashboardPage() {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signup')

  // Parallel queries
  const [artistRes, accountRes, releasesRes, purchasesRes, codesRes, fanProfileRes, merchRes, ordersRes] = await Promise.all([
    supabase.from('artists').select('id, slug, name, bio, avatar_url, banner_url, accent_colour, social_links, first_year_zero_fees, first_year_zero_fees_start, milestone_first_sale, milestone_first_sale_at, milestone_first_sale_shown, return_address').eq('id', user.id).maybeSingle(),
    supabase.from('artist_accounts').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('releases')
      .select('id, slug, title, type, cover_url, price_pence, published, pwyw_enabled, pwyw_minimum_pence, preorder_enabled, release_date, visibility, created_at, tracks(id, preview_plays, full_plays)')
      .eq('artist_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('purchases')
      .select('id, release_id, buyer_email, buyer_user_id, amount_pence, artist_pence, platform_pence, stripe_fee_pence, status, paid_at, created_at')
      .eq('artist_id', user.id)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false }),
    supabase.from('download_codes')
      .select('id, release_id, code, redeemed_by, redeemed_at')
      .eq('artist_id', user.id),
    supabase.from('fan_profiles')
      .select('referral_code, referral_count, first_year_zero_fees, username, is_public')
      .eq('id', user.id)
      .single(),
    supabase.from('merch')
      .select('id, name, description, price, currency, postage, stock, variants, dispatch_estimate, photos, is_active, created_at')
      .eq('artist_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('orders')
      .select('id, fan_id, merch_id, variant_selected, amount_paid, amount_paid_currency, shipping_address, tracking_number, carrier, status, created_at, dispatched_at, delivered_at, return_requested_at, merch(name, photos, dispatch_estimate)')
      .eq('artist_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const artist = artistRes.data
  const account = accountRes.data
  const releases = releasesRes.data || []
  const purchases = purchasesRes.data || []
  const codes = codesRes.data || []
  const fanProfile = fanProfileRes.data
  const merchItems = merchRes.data || []
  const merchOrders = ordersRes.data || []

  if (!artist || !account) redirect('/become-an-artist')

  // Fetch favourite counts for this artist's releases and tracks
  const releaseIds = releases.map(r => r.id)
  const trackIds = releases.flatMap(r => (r.tracks || []).map((t: any) => t.id))

  const [relFavRes, trkFavRes] = await Promise.all([
    releaseIds.length > 0
      ? supabase.from('release_favourite_counts').select('release_id, save_count').in('release_id', releaseIds)
      : Promise.resolve({ data: [] as { release_id: string; save_count: number }[] }),
    trackIds.length > 0
      ? supabase.from('track_favourite_counts').select('track_id, save_count').in('track_id', trackIds)
      : Promise.resolve({ data: [] as { track_id: string; save_count: number }[] }),
  ])

  const saveCounts: Record<string, number> = {}
  for (const r of (relFavRes as any).data || []) saveCounts[`release:${r.release_id}`] = r.save_count
  for (const t of (trkFavRes as any).data || []) saveCounts[`track:${t.track_id}`] = t.save_count

  // Compute stats
  const totalEarningsPence = purchases.reduce((s, p) => s + p.artist_pence, 0)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEarningsPence = purchases
    .filter(p => p.paid_at && p.paid_at >= monthStart)
    .reduce((s, p) => s + p.artist_pence, 0)
  const totalSales = purchases.length
  const uniqueFans = new Set(purchases.map(p => p.buyer_email)).size

  const totalPreviewPlays = releases.reduce((s, r) =>
    s + (r.tracks?.reduce((ts: number, t: any) => ts + (t.preview_plays || 0), 0) || 0), 0)
  const totalFullPlays = releases.reduce((s, r) =>
    s + (r.tracks?.reduce((ts: number, t: any) => ts + (t.full_plays || 0), 0) || 0), 0)

  // PWYW average
  const pwywReleaseIds = new Set(releases.filter(r => r.pwyw_enabled).map(r => r.id))
  const pwywPurchases = purchases.filter(p => pwywReleaseIds.has(p.release_id))
  const avgPaidPence = pwywPurchases.length > 0
    ? Math.round(pwywPurchases.reduce((s, p) => s + p.amount_pence, 0) / pwywPurchases.length)
    : 0
  const avgMinPence = releases
    .filter(r => r.pwyw_enabled && r.pwyw_minimum_pence != null)
    .reduce((s, r, _, arr) => s + (r.pwyw_minimum_pence || 0) / arr.length, 0)

  // Fan list (privacy-safe: hash email for display)
  const fanMap = new Map<string, { email: string; userId: string | null; purchases: typeof purchases; totalPence: number }>()
  for (const p of purchases) {
    const existing = fanMap.get(p.buyer_email)
    if (existing) {
      existing.purchases.push(p)
      existing.totalPence += p.amount_pence
    } else {
      fanMap.set(p.buyer_email, { email: p.buyer_email, userId: (p as any).buyer_user_id ?? null, purchases: [p], totalPence: p.amount_pence })
    }
  }

  // Batch-fetch founding_fan badges for all fan user IDs
  const fanUserIds = [...new Set(Array.from(fanMap.values()).map(f => f.userId).filter(Boolean))] as string[]
  const fanBadgeMap = new Map<string, { badge_type: string; metadata?: { position?: number } | null }>()
  if (fanUserIds.length > 0) {
    const { data: fanBadges } = await supabase
      .from('fan_badges')
      .select('user_id, badge_type, metadata')
      .in('user_id', fanUserIds)
      .eq('badge_type', 'founding_fan')
    for (const b of fanBadges || []) {
      fanBadgeMap.set(b.user_id, { badge_type: b.badge_type, metadata: b.metadata as any })
    }
  }

  const fans = Array.from(fanMap.values())
    .sort((a, b) => b.totalPence - a.totalPence)
    .map(f => ({
      displayEmail: maskEmail(f.email),
      purchaseCount: f.purchases.length,
      totalPence: f.totalPence,
      purchases: f.purchases.map(p => ({
        release_id: p.release_id,
        amount_pence: p.amount_pence,
        paid_at: p.paid_at,
      })),
      badge: f.userId ? fanBadgeMap.get(f.userId) ?? null : null,
    }))

  // Download codes per release
  const codesByRelease = new Map<string, { total: number; redeemed: number }>()
  for (const c of codes) {
    const existing = codesByRelease.get(c.release_id) || { total: 0, redeemed: 0 }
    existing.total++
    if (c.redeemed_by) existing.redeemed++
    codesByRelease.set(c.release_id, existing)
  }

  return (
    <DashboardClient
      artist={artist}
      account={account}
      releases={releases}
      stats={{
        totalEarningsPence,
        monthEarningsPence,
        totalSales,
        totalPreviewPlays,
        totalFullPlays,
        uniqueFans,
        avgPaidPence,
        avgMinPence: Math.round(avgMinPence),
      }}
      fans={fans}
      codesByRelease={Object.fromEntries(codesByRelease)}
      fanUsername={fanProfile?.username ?? null}
      fanIsPublic={fanProfile?.is_public ?? false}
      milestone={artist.milestone_first_sale && !artist.milestone_first_sale_shown ? {
        artistName: artist.name,
        achievedAt: artist.milestone_first_sale_at,
      } : undefined}
      merchItems={merchItems}
      merchOrders={merchOrders as any}
      returnAddress={artist.return_address}
      saveCounts={saveCounts}
      referral={fanProfile ? {
        code: fanProfile.referral_code,
        count: fanProfile.referral_count,
        zeroFeesUnlocked: fanProfile.first_year_zero_fees,
        zeroFeesStart: artist.first_year_zero_fees_start,
        artistHasZeroFees: artist.first_year_zero_fees,
      } : undefined}
    />
  )
  } catch (e: any) {
    return <pre style={{ padding: '2rem', color: '#f97316' }}>Dashboard error: {e?.message ?? String(e)}{'\n'}{e?.stack}</pre>
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  const maskedLocal = local.length <= 2 ? local[0] + '***' : local[0] + '***' + local[local.length - 1]
  return `${maskedLocal}@${domain}`
}
