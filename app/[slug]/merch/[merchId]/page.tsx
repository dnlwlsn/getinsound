import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MerchItemClient from './MerchItemClient'


interface Props {
  params: Promise<{ slug: string; merchId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, merchId } = await params
  const supabase = await createClient()

  const { data: merch } = await supabase
    .from('merch')
    .select('name, description, photos, artists!inner(name)')
    .eq('id', merchId)
    .eq('is_active', true)
    .maybeSingle()

  if (!merch) return {}

  const artist = Array.isArray(merch.artists) ? merch.artists[0] : merch.artists
  const title = `${merch.name} by ${artist?.name} | insound.`
  const description = merch.description?.slice(0, 160) || `Buy ${merch.name} from ${artist?.name} on Insound.`
  const photos = (merch.photos as string[]) || []

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: photos.length > 0 ? [{ url: photos[0] }] : undefined,
    },
  }
}

export default async function MerchItemPage({ params }: Props) {
  const { slug, merchId } = await params
  const supabase = await createClient()

  const { data: merch } = await supabase
    .from('merch')
    .select(`
      id, name, description, price, currency, postage, stock, variants,
      dispatch_estimate, photos, artist_id,
      artists!inner ( id, slug, name, accent_colour, social_links )
    `)
    .eq('id', merchId)
    .eq('is_active', true)
    .maybeSingle()

  if (!merch) notFound()

  const artist = Array.isArray(merch.artists) ? merch.artists[0] : merch.artists
  if (artist.slug !== slug) notFound()

  const [{ data: account }, { data: { user } }] = await Promise.all([
    supabase.from('artist_accounts')
      .select('stripe_onboarded, country')
      .eq('id', merch.artist_id)
      .maybeSingle(),
    supabase.auth.getUser(),
  ])

  return (
    <MerchItemClient
      merch={{
        id: merch.id,
        name: merch.name,
        description: merch.description,
        price: merch.price,
        currency: merch.currency,
        postage: merch.postage,
        stock: merch.stock,
        variants: (merch.variants as string[]) || null,
        dispatch_estimate: merch.dispatch_estimate,
        photos: (merch.photos as string[]) || [],
      }}
      artist={{
        id: artist.id,
        slug: artist.slug,
        name: artist.name,
        accent_colour: artist.accent_colour,
        country: account?.country || 'GB',
      }}
      canCheckout={!!account?.stripe_onboarded}
      userId={user?.id || null}
    />
  )
}
