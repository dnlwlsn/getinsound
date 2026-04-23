import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import LibraryClient from './LibraryClient'
import LibrarySignIn from './LibrarySignIn'

export const runtime = 'edge'
export const metadata: Metadata = {
  title: 'My Library | Insound',
  description:
    'Your Insound music library. Stream, download, and revisit everything you own.',
}

export interface LibraryRelease {
  purchaseId: string
  releaseId: string
  releaseTitle: string
  releaseType: 'album' | 'ep' | 'single'
  coverUrl: string | null
  artistId: string
  artistName: string
  artistSlug: string
  accentColour: string | null
  genre: string | null
  tags: string[]
  displayAmount: number
  displayCurrency: string
  purchasedAt: string
  preOrder: boolean
  releaseDate: string | null
  tracks: LibraryTrack[]
  artistBadge?: { badge_type: string; metadata?: { position?: number } | null } | null
  artistVerified?: boolean
}

export interface LibraryTrack {
  id: string
  title: string
  position: number
  durationSec: number | null
  audioPath: string
}

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <LibrarySignIn />
  }

  const [purchasesResult, ordersResult] = await Promise.all([
    supabase
      .from('purchases')
      .select(`
        id,
        release_id,
        amount_pence,
        fan_currency,
        fan_amount,
        paid_at,
        created_at,
        pre_order,
        release_date,
        releases (
          id, title, type, cover_url, artist_id, currency,
          artists ( id, name, slug, accent_colour ),
          tracks ( id, title, position, duration_sec, audio_path ),
          release_tags ( tag )
        )
      `)
      .eq('buyer_user_id', user.id)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false, nullsFirst: false }),
    supabase
      .from('orders')
      .select('id, merch_id, variant_selected, amount_paid, amount_paid_currency, tracking_number, carrier, status, created_at, dispatched_at, delivered_at, return_requested_at, merch(name, photos), artists(name, slug, accent_colour)')
      .eq('fan_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const purchases = purchasesResult.data
  const error = purchasesResult.error
  const merchOrders = ordersResult.data || []

  if (error) {
    return <LibraryClient releases={[]} error={error.message} userId={user.id} />
  }

  // Collect unique artist IDs and batch-fetch founding_artist badges
  const allArtistIds = [...new Set(
    (purchases ?? []).filter((p: any) => p.releases).map((p: any) => {
      const artist = Array.isArray(p.releases.artists) ? p.releases.artists[0] : p.releases.artists
      return artist?.id
    }).filter(Boolean)
  )] as string[]

  const artistBadgeMap = new Map<string, { badge_type: string; metadata?: { position?: number } | null }>()
  const artistVerifiedSet = new Set<string>()
  if (allArtistIds.length > 0) {
    const [{ data: badges }, { data: accounts }] = await Promise.all([
      supabase
        .from('fan_badges')
        .select('user_id, badge_type, metadata')
        .in('user_id', allArtistIds)
        .eq('badge_type', 'founding_artist'),
      supabase
        .from('artist_accounts')
        .select('id, stripe_verified, independence_confirmed')
        .in('id', allArtistIds),
    ])
    for (const b of badges || []) {
      artistBadgeMap.set(b.user_id, { badge_type: b.badge_type, metadata: b.metadata as any })
    }
    for (const acc of accounts || []) {
      if (acc.stripe_verified && acc.independence_confirmed) artistVerifiedSet.add(acc.id)
    }
  }

  const releases: LibraryRelease[] = (purchases ?? [])
    .filter((p: any) => p.releases)
    .map((p: any) => {
      const r = p.releases
      const artist = Array.isArray(r.artists) ? r.artists[0] : r.artists
      const tracks = (r.tracks ?? [])
        .sort((a: any, b: any) => a.position - b.position)
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          position: t.position,
          durationSec: t.duration_sec,
          audioPath: t.audio_path,
        }))

      const displayCurrency = p.fan_currency ?? r.currency ?? 'GBP'
      const displayAmount = p.fan_amount ?? p.amount_pence
      const artistId = artist?.id ?? 'unknown'

      return {
        purchaseId: p.id,
        releaseId: r.id,
        releaseTitle: r.title,
        releaseType: r.type,
        coverUrl: r.cover_url,
        artistId,
        artistName: artist?.name ?? 'Unknown Artist',
        artistSlug: artist?.slug ?? '',
        accentColour: artist?.accent_colour ?? null,
        genre: null,
        tags: (r.release_tags ?? []).map((t: any) => t.tag),
        displayAmount,
        displayCurrency,
        purchasedAt: p.paid_at ?? p.created_at,
        preOrder: p.pre_order && p.release_date ? new Date(p.release_date) > new Date() : false,
        releaseDate: p.release_date ?? null,
        tracks,
        artistBadge: artistBadgeMap.get(artistId) ?? null,
        artistVerified: artistVerifiedSet.has(artistId),
      }
    })

  const { data: wishlistData } = await supabase
    .from('fan_wishlist')
    .select(`
      id, created_at, release_id,
      releases (
        id, slug, title, type, cover_url, price_pence, currency,
        artists ( slug, name, accent_colour )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const wishlist = (wishlistData ?? []).map((w: any) => {
    const r = w.releases
    const artist = Array.isArray(r.artists) ? r.artists[0] : r.artists
    return {
      wishlistId: w.id,
      releaseId: r.id,
      releaseSlug: r.slug,
      title: r.title,
      type: r.type,
      coverUrl: r.cover_url,
      pricePence: r.price_pence,
      currency: r.currency ?? 'GBP',
      artistName: artist?.name ?? 'Unknown',
      artistSlug: artist?.slug ?? '',
      accentColour: artist?.accent_colour ?? null,
      savedAt: w.created_at,
    }
  })

  return <LibraryClient releases={releases} error={null} userId={user.id} wishlist={wishlist} merchOrders={merchOrders as any} />
}
