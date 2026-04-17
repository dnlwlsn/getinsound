import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ArtistProfileClient from './ArtistProfileClient'
export const runtime = 'edge';

interface Props {
  params: Promise<{ slug: string }>
}

const STATIC_ROUTES = new Set([
  'ai-policy', 'api', 'auth', 'components', 'dashboard', 'discography',
  'download', 'explore', 'for-artists', 'for-fans', 'for-press',
  'library', 'player', 'privacy', 'release', 'sales', 'terms', 'why-us',
  '_not-found', '_document', '_app', '_error',
])

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (STATIC_ROUTES.has(slug)) return {}

  const supabase = await createClient()
  const { data: artist } = await supabase
    .from('artists')
    .select('name, bio')
    .eq('slug', slug)
    .maybeSingle()

  if (!artist) return {}

  const title = `${artist.name} | insound.`
  const description = artist.bio || `Listen to ${artist.name} on Insound. Buy music directly from the artist.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'profile' },
  }
}

export default async function ArtistPage({ params }: Props) {
  const { slug } = await params
  if (STATIC_ROUTES.has(slug)) notFound()

  const supabase = await createClient()

  const { data: artist } = await supabase
    .from('artists')
    .select('id, slug, name, bio, avatar_url, accent_colour')
    .eq('slug', slug)
    .maybeSingle()

  if (!artist) notFound()

  const { data: releases } = await supabase
    .from('releases')
    .select('id, slug, title, type, cover_url, price_pence, published, pwyw_enabled, pwyw_minimum_pence, preorder_enabled, release_date, tracks(id, title, position, duration_sec)')
    .eq('artist_id', artist.id)
    .eq('published', true)
    .order('created_at', { ascending: false })

  return (
    <ArtistProfileClient
      artist={artist}
      releases={(releases || []).map(r => ({
        ...r,
        tracks: [...(r.tracks || [])].sort((a, b) => a.position - b.position),
      }))}
    />
  )
}
