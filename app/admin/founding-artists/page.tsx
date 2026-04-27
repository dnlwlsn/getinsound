import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin'
import { FoundingArtistsClient } from './FoundingArtistsClient'

export const metadata: Metadata = {
  title: 'Founding Artists — Admin | Insound',
}

export default async function FoundingArtistsPage() {
  const { supabase } = await requireAdmin()

  const [{ data: programme }, { data: artists }, { data: purchases }] = await Promise.all([
    supabase
      .from('founding_artist_programme')
      .select('total_spots, filled_count, paused')
      .eq('id', 1)
      .single(),
    supabase
      .from('artists')
      .select('id, name, founding_artist_confirmed_at, founding_artist_first_sale_at')
      .eq('founding_artist', true)
      .order('founding_artist_confirmed_at', { ascending: true }),
    supabase
      .from('purchases')
      .select('artist_id, amount_pence, paid_at')
      .eq('status', 'paid'),
  ])

  const foundingArtists = (artists || []).map(a => {
    const artistPurchases = (purchases || []).filter(p => p.artist_id === a.id)
    const firstSaleAt = a.founding_artist_first_sale_at
    const now = new Date()

    let musicSalesInWindow = 0
    if (firstSaleAt) {
      const windowEnd = new Date(firstSaleAt)
      windowEnd.setFullYear(windowEnd.getFullYear() + 1)
      musicSalesInWindow = artistPurchases
        .filter(p => p.paid_at && new Date(p.paid_at) >= new Date(firstSaleAt) && new Date(p.paid_at) < windowEnd)
        .reduce((s, p) => s + p.amount_pence, 0)
    }

    const totalSalesPence = artistPurchases.reduce((s, p) => s + p.amount_pence, 0)
    const estimatedDiscountPence = Math.round(musicSalesInWindow * 0.025)

    let daysRemaining: number | null = null
    if (firstSaleAt) {
      const windowEnd = new Date(firstSaleAt)
      windowEnd.setFullYear(windowEnd.getFullYear() + 1)
      daysRemaining = Math.max(0, Math.ceil((windowEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    }

    return {
      id: a.id,
      name: a.name,
      confirmedAt: a.founding_artist_confirmed_at,
      firstSaleAt: a.founding_artist_first_sale_at,
      daysRemaining,
      totalSalesPence,
      estimatedDiscountPence,
    }
  })

  const totalDiscount = foundingArtists.reduce((s, a) => s + a.estimatedDiscountPence, 0)

  return (
    <FoundingArtistsClient
      programme={programme || { total_spots: 50, filled_count: 0, paused: false }}
      artists={foundingArtists}
      totalDiscountPence={totalDiscount}
    />
  )
}
