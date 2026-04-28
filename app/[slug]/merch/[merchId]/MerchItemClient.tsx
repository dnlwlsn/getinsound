'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { resolveAccent } from '@/lib/accent'
import { useCurrency } from '@/app/providers/CurrencyProvider'
import { calculateMerchFees } from '@/app/lib/fees'
import { loadStripe } from '@stripe/stripe-js'
import { useBasketStore, type MerchBasketItem } from '@/lib/stores/basket'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const StripeCheckoutEmbed = dynamic(
  () => import('@stripe/react-stripe-js').then(mod => {
    const { EmbeddedCheckoutProvider, EmbeddedCheckout } = mod
    return function StripeEmbed({ clientSecret, stripePromise: sp }: { clientSecret: string; stripePromise: Promise<any> }) {
      return (
        <EmbeddedCheckoutProvider stripe={sp} options={{ clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      )
    }
  }),
  { ssr: false }
)

interface MerchData {
  id: string
  name: string
  description: string
  price: number
  currency: string
  postage: number
  stock: number
  variants: string[] | null
  dispatch_estimate: string
  photos: string[]
}

interface ArtistData {
  id: string
  slug: string
  name: string
  accent_colour: string | null
  country: string
}

interface Props {
  merch: MerchData
  artist: ArtistData
  canCheckout: boolean
  userId: string | null
}

export default function MerchItemClient({ merch, artist, canCheckout, userId }: Props) {
  const accent = resolveAccent(artist.accent_colour)
  const { currency, formatPrice, convertPrice, locale } = useCurrency()
  const [selectedVariant, setSelectedVariant] = useState<string | null>(
    merch.variants && merch.variants.length > 0 ? null : '__none__'
  )
  const [selectedPhoto, setSelectedPhoto] = useState(0)
  const [checkoutClientSecret, setCheckoutClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { add: addToBasket, has: inBasket } = useBasketStore()
  const [addedToBasket, setAddedToBasket] = useState(false)

  const merchBasketItem: MerchBasketItem | null = selectedVariant ? {
    type: 'merch',
    merchId: merch.id,
    merchName: merch.name,
    variant: selectedVariant === '__none__' ? null : selectedVariant,
    pricePence: merch.price,
    postagePence: merch.postage,
    currency: merch.currency || 'GBP',
    photoUrl: merch.photos[0] || null,
    artistId: artist.id,
    artistName: artist.name,
    artistSlug: artist.slug,
    accentColour: artist.accent_colour,
  } : null

  const isInBasket = merchBasketItem ? inBasket(merchBasketItem) : false

  const handleAddToBasket = useCallback(() => {
    if (!merchBasketItem || isInBasket) return
    addToBasket(merchBasketItem)
    setAddedToBasket(true)
    setTimeout(() => setAddedToBasket(false), 2000)
  }, [merchBasketItem, isInBasket, addToBasket])

  const artistCurrency = merch.currency || 'GBP'
  const itemDisplay = formatPrice(convertPrice(merch.price / 100, artistCurrency, currency))
  const postageDisplay = formatPrice(convertPrice(merch.postage / 100, artistCurrency, currency))
  const totalDisplay = formatPrice(convertPrice((merch.price + merch.postage) / 100, artistCurrency, currency))

  const fanRegion = locale || 'GB'
  const fees = calculateMerchFees(
    merch.price / 100,
    merch.postage / 100,
    fanRegion,
    artist.country,
    currency,
    artistCurrency,
  )
  const artistReceivesDisplay = formatPrice(convertPrice(fees.artistReceives, artistCurrency, currency))

  const soldOut = merch.stock <= 0
  const needsVariant = merch.variants && merch.variants.length > 0
  const canBuy = canCheckout && !soldOut && (selectedVariant !== null)

  const handleBuy = useCallback(async () => {
    if (!canBuy) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/checkout-merch-create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            merch_id: merch.id,
            variant: selectedVariant === '__none__' ? undefined : selectedVariant,
            fan_currency: currency,
            fan_locale: fanRegion,
            fan_id: userId,
            origin: window.location.origin,
          }),
        }
      )

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create checkout')

      setCheckoutClientSecret(data.client_secret)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [canBuy, merch.id, selectedVariant, currency, fanRegion, userId])

  if (checkoutClientSecret) {
    return (
      <main className="flex-1 min-h-screen bg-insound-bg">
        <nav className="sticky top-0 w-full z-50 flex justify-between items-center px-6 md:px-14 py-5 border-b border-zinc-900/80" style={{ background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(20px)' }}>
          <Link href="/" className="text-2xl font-black text-orange-600 tracking-tighter font-display">insound.</Link>
        </nav>
        <div className="max-w-2xl mx-auto px-6 py-12">
          <StripeCheckoutEmbed clientSecret={checkoutClientSecret} stripePromise={stripePromise} />
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 min-h-screen bg-insound-bg" style={{ '--artist-accent': accent } as React.CSSProperties}>
      <nav className="sticky top-0 w-full z-50 flex justify-between items-center px-6 md:px-14 py-5 border-b border-zinc-900/80" style={{ background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(20px)' }}>
        <Link href="/" className="text-2xl font-black text-orange-600 tracking-tighter font-display">insound.</Link>
        <Link href={`/${artist.slug}`} className="text-sm font-bold text-zinc-400 hover:text-white transition-colors">
          ← {artist.name}
        </Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 md:px-12 py-12">
        <div className="flex flex-col md:flex-row gap-10">
          {/* Photo gallery */}
          <div className="flex-1 min-w-0">
            <div className="aspect-square rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 mb-3">
              {merch.photos.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={merch.photos[selectedPhoto]} alt={merch.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-700">
                  <svg width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              )}
            </div>
            {merch.photos.length > 1 && (
              <div className="flex gap-2">
                {merch.photos.map((photo, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedPhoto(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === selectedPhoto ? 'border-orange-500' : 'border-zinc-800 hover:border-zinc-600'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt={`${merch.name} photo ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: accent }}>
              {artist.name}
            </p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight font-display text-white mb-4">
              {merch.name}
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6 whitespace-pre-wrap">
              {merch.description}
            </p>

            <p className="text-zinc-500 text-xs font-bold mb-6">
              {merch.dispatch_estimate}
            </p>

            {/* Variant selector */}
            {needsVariant && (
              <div className="mb-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Size / Variant</p>
                <div className="flex flex-wrap gap-2">
                  {merch.variants!.map((v) => (
                    <button
                      key={v}
                      onClick={() => setSelectedVariant(v)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                        selectedVariant === v
                          ? 'ring-2 text-white'
                          : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 ring-1 ring-zinc-800'
                      }`}
                      style={selectedVariant === v ? { background: `${accent}22`, color: accent, boxShadow: `0 0 0 2px ${accent}` } : undefined}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock indicator */}
            {merch.stock > 0 && merch.stock <= 5 && (
              <p className="text-orange-500 text-xs font-bold mb-4">Only {merch.stock} left</p>
            )}

            {/* Fee breakdown */}
            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Item</span>
                <span className="text-white font-bold">{itemDisplay}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Postage</span>
                <span className="text-white font-bold">{postageDisplay}</span>
              </div>
              <div className="border-t border-zinc-800 pt-2 flex justify-between text-sm">
                <span className="text-white font-bold">You pay</span>
                <span className="font-black" style={{ color: accent }}>{totalDisplay}</span>
              </div>
              <p className="text-[11px] text-zinc-600 pt-1">
                Artist receives ~{artistReceivesDisplay} after fees (estimate)
              </p>
            </div>

            {/* Buy button */}
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleBuy}
                disabled={!canBuy || loading}
                className="flex-1 py-3.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: canBuy ? accent : undefined, color: canBuy ? '#000' : undefined }}
              >
                {loading ? 'Loading...' : soldOut ? 'Sold Out' : needsVariant && !selectedVariant ? 'Select a size' : `Buy — ${totalDisplay}`}
              </button>
              {!soldOut && (
                <button
                  onClick={handleAddToBasket}
                  disabled={!canBuy || isInBasket}
                  className="relative px-4 py-3.5 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label={isInBasket ? 'In basket' : 'Add to basket'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={isInBasket ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isInBasket ? 'text-orange-500' : ''}>
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
                  </svg>
                  {addedToBasket && (
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap bg-zinc-800 border border-zinc-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl z-50">
                      Added to basket
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
