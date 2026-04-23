import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import LibraryClient from './LibraryClient'
import LibrarySignIn from './LibrarySignIn'

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
  displayAmount: number
  displayCurrency: string
  purchasedAt: string
  preOrder: boolean
  releaseDate: string | null
  tracks: LibraryTrack[]
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

  const { data: purchases, error } = await supabase
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
        tracks ( id, title, position, duration_sec, audio_path )
      )
    `)
    .eq('buyer_user_id', user.id)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false, nullsFirst: false })

  if (error) {
    return <LibraryClient releases={[]} error={error.message} />
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

      return {
        purchaseId: p.id,
        releaseId: r.id,
        releaseTitle: r.title,
        releaseType: r.type,
        coverUrl: r.cover_url,
        artistId: artist?.id ?? 'unknown',
        artistName: artist?.name ?? 'Unknown Artist',
        artistSlug: artist?.slug ?? '',
        accentColour: artist?.accent_colour ?? null,
        genre: null,
        displayAmount,
        displayCurrency,
        purchasedAt: p.paid_at ?? p.created_at,
        preOrder: p.pre_order && p.release_date ? new Date(p.release_date) > new Date() : false,
        releaseDate: p.release_date ?? null,
        tracks,
      }
    })

  return <LibraryClient releases={releases} error={null} userId={user.id} />
}
