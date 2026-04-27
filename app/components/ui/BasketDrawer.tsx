'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { useBasketStore, type BasketItem } from '@/lib/stores/basket'
import { useCurrency } from '@/app/providers/CurrencyProvider'
import { createClient } from '@/lib/supabase/client'
import { calculateFeesPence } from '@/app/lib/fees'
import Link from 'next/link'

type Stage = 'review' | 'checkout' | 'preparing' | 'consent' | 'download' | 'confirmed' | 'error'

const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!

interface Props {
  onClose: () => void
}

export function BasketDrawer({ onClose }: Props) {
  const { items, remove, clear, total, itemsTotal, postageTotal, hasMerch } = useBasketStore()
  const { currency, formatPrice, convertPrice } = useCurrency()
  const [stage, setStage] = useState<Stage>('review')
  const [errorTitle, setErrorTitle] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [downloadTracks, setDownloadTracks] = useState<{ releaseTitle: string; tracks: { title: string; url?: string }[] }[]>([])
  const [digitalConsent, setDigitalConsent] = useState(false)
  const [consentBusy, setConsentBusy] = useState(false)
  const [basketHadMerch, setBasketHadMerch] = useState(false)
  const [basketHadReleases, setBasketHadReleases] = useState(false)
  const [merchOrderNames, setMerchOrderNames] = useState<string[]>([])
  const sessionIdRef = useRef<string | null>(null)
  const stripeMountRef = useRef<HTMLDivElement>(null)
  const embeddedCheckoutRef = useRef<any>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Focus trap: keep focus inside the drawer while open
  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    const drawer = drawerRef.current
    if (!drawer) return

    const focusableSelector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    const getFocusable = () => Array.from(drawer.querySelectorAll<HTMLElement>(focusableSelector)).filter(el => el.offsetParent !== null)

    // Focus first focusable element
    requestAnimationFrame(() => {
      const els = getFocusable()
      if (els.length > 0) els[0].focus()
    })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const els = getFocusable()
      if (els.length === 0) return
      const first = els[0]
      const last = els[els.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocusedRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClose = useCallback(() => {
    document.body.style.overflow = ''
    if (embeddedCheckoutRef.current) {
      try { embeddedCheckoutRef.current.destroy() } catch {}
      embeddedCheckoutRef.current = null
    }
    if (stripeMountRef.current) stripeMountRef.current.innerHTML = ''
    onClose()
  }, [onClose])

  const openCheckout = useCallback(async () => {
    if (items.length === 0) return
    setStage('checkout')

    // Capture basket composition before checkout
    const hadReleases = items.some(i => i.type === 'release')
    const hadMerch = items.some(i => i.type === 'merch')
    const merchNames = items.filter(i => i.type === 'merch').map(i => (i as any).merchName as string)
    setBasketHadReleases(hadReleases)
    setBasketHadMerch(hadMerch)
    setMerchOrderNames(merchNames)

    try {
      if (!(window as any).Stripe) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://js.stripe.com/v3/'
          s.onload = () => resolve()
          s.onerror = () => reject(new Error('Failed to load payment system.'))
          document.head.appendChild(s)
        })
      }
      const stripe = (window as any).Stripe(STRIPE_PUBLISHABLE_KEY)
      const supabase = createClient()
      const refCookie = document.cookie.split('; ').find(c => c.startsWith('insound_ref='))
      const refCode = refCookie?.split('=')[1] || undefined

      const { data, error } = await supabase.functions.invoke('checkout-basket-create', {
        body: {
          items: items.map(i =>
            i.type === 'merch'
              ? { type: 'merch', merch_id: i.merchId, variant: i.variant ?? undefined }
              : { type: 'release', release_id: i.releaseId, custom_amount: i.customAmountPence }
          ),
          fan_currency: currency,
          origin: window.location.origin,
          ref_code: refCode,
        },
      })
      if (error) throw error
      if (!data?.sessions || data.sessions.length === 0) throw new Error('No checkout session returned')

      // Use the first session (single-artist baskets are most common)
      // Multi-artist baskets will sequentially complete each session
      const firstSession = data.sessions[0]
      sessionIdRef.current = firstSession.session_id
      const embedded = await stripe.initEmbeddedCheckout({
        clientSecret: firstSession.client_secret,
        onComplete: () => {
          setStage('confirmed')
          clear()
        },
      })
      embeddedCheckoutRef.current = embedded

      requestAnimationFrame(() => {
        if (stripeMountRef.current) embedded.mount(stripeMountRef.current)
      })
    } catch (err: any) {
      setErrorTitle("Couldn't open checkout.")
      setErrorMsg(err.message || 'Please try again.')
      setStage('error')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, currency])

  async function pollForDownloads(sessionId: string) {
    const supabase = createClient()
    const maxAttempts = 15
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const { data, error } = await supabase.functions.invoke('download', {
          body: { session_id: sessionId },
        })
        if (data && data.releases) {
          setDownloadTracks(data.releases)
          setDigitalConsent(false)
          setStage('consent')
          clear()
          return
        }
        if (data && data.release) {
          setDownloadTracks([{ releaseTitle: data.release.title, tracks: data.tracks }])
          setDigitalConsent(false)
          setStage('consent')
          clear()
          return
        }
        let body: any = null
        try { body = await error?.context?.response?.json?.() } catch {}
        if (body && body.error !== 'pending') throw new Error(body.error || 'Could not load downloads')
      } catch (err) {
        if (i === maxAttempts - 1) {
          setErrorTitle('Still finalising...')
          setErrorMsg("Your payment went through but the downloads aren't ready. Check your library in a moment.")
          setStage('error')
          clear()
          return
        }
      }
      await new Promise((r) => setTimeout(r, 1500))
    }
    setErrorTitle('Still finalising...')
    setErrorMsg("Your payment went through but the downloads aren't ready. Check your library in a moment.")
    setStage('error')
    clear()
  }

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const key = item.artistId
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping basket"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div ref={drawerRef} className="absolute top-0 right-0 h-full w-full max-w-lg bg-zinc-950 border-l border-zinc-800 shadow-2xl overflow-y-auto animate-[slide-in-right_0.3s_ease_both]">
        <button
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white transition-colors shadow-lg"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>

        {/* Stage: Review basket */}
        {stage === 'review' && (
          <div className="p-6 md:p-8 pt-16">
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2">Your basket</p>
            <h2 className="text-2xl font-black mb-6 font-display">
              {items.length} item{items.length !== 1 ? 's' : ''}
            </h2>

            {items.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-600">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
                  </svg>
                </div>
                <p className="text-zinc-500 text-sm font-bold mb-1">Your basket is empty</p>
                <p className="text-zinc-600 text-xs">Browse releases and add them here.</p>
              </div>
            ) : (
              <>
                {Object.entries(grouped).map(([artistId, artistItems]) => (
                  <div key={artistId} className="mb-6">
                    <Link
                      href={`/${artistItems[0].artistSlug}`}
                      className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors mb-3 block"
                    >
                      {artistItems[0].artistName}
                    </Link>
                    <div className="space-y-2">
                      {artistItems.map((item) => {
                        const artistCurrency = item.currency || 'GBP'

                        if (item.type === 'release') {
                          const displayPrice = formatPrice(convertPrice((item.customAmountPence ?? item.pricePence) / 100, artistCurrency, currency))
                          return (
                            <div key={item.releaseId} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-[#141414] transition-colors">
                              <Link href={`/release?a=${item.artistSlug}&r=${item.releaseSlug}`} className="w-10 h-10 rounded shrink-0 overflow-hidden bg-zinc-900">
                                {item.coverUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.coverUrl} alt={item.releaseTitle} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full" style={{ background: item.accentColour || '#F56D00' }} />
                                )}
                              </Link>
                              <div className="flex-1 min-w-0">
                                <Link href={`/release?a=${item.artistSlug}&r=${item.releaseSlug}`} className="font-semibold text-sm text-white truncate block hover:opacity-80 transition-opacity">
                                  {item.releaseTitle}
                                </Link>
                              </div>
                              <span className="text-[13px] font-semibold text-orange-500 shrink-0">{displayPrice}</span>
                              <button
                                onClick={() => remove(item)}
                                className="shrink-0 p-1.5 text-zinc-600 hover:text-red-400 transition-colors"
                                aria-label={`Remove ${item.releaseTitle}`}
                              >
                                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          )
                        }

                        // Merch item
                        const displayPrice = formatPrice(convertPrice(item.pricePence / 100, artistCurrency, currency))
                        const postageFormatted = item.postagePence > 0
                          ? formatPrice(convertPrice(item.postagePence / 100, artistCurrency, currency))
                          : null
                        return (
                          <div key={`${item.merchId}-${item.variant}`} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-[#141414] transition-colors">
                            <Link href={`/${item.artistSlug}/merch/${item.merchId}`} className="w-10 h-10 rounded shrink-0 overflow-hidden bg-zinc-900">
                              {item.photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={item.photoUrl} alt={item.merchName} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-zinc-800" />
                              )}
                            </Link>
                            <div className="flex-1 min-w-0">
                              <Link href={`/${item.artistSlug}/merch/${item.merchId}`} className="font-semibold text-sm text-white truncate block hover:opacity-80 transition-opacity">
                                {item.merchName}
                              </Link>
                              {item.variant && (
                                <span className="text-[11px] text-zinc-500 font-medium">{item.variant}</span>
                              )}
                              {postageFormatted && (
                                <span className="text-[11px] text-zinc-500 font-medium block">+ {postageFormatted} P&amp;P</span>
                              )}
                            </div>
                            <span className="text-[13px] font-semibold text-orange-500 shrink-0">{displayPrice}</span>
                            <button
                              onClick={() => remove(item)}
                              className="shrink-0 p-1.5 text-zinc-600 hover:text-red-400 transition-colors"
                              aria-label={`Remove ${item.merchName}`}
                            >
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M18 6L6 18M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                <BasketSummary items={items} itemsTotal={itemsTotal} postageTotal={postageTotal} total={total} hasMerch={hasMerch} openCheckout={openCheckout} />
              </>
            )}
          </div>
        )}

        {/* Stage: Stripe checkout */}
        {stage === 'checkout' && (
          <div>
            <div ref={stripeMountRef} className="min-h-[400px]" />
            <p className="text-[10px] text-zinc-600 px-6 pb-4 leading-relaxed">
              By completing this purchase, you agree to receive immediate access to digital content and waive your 14-day cancellation right once the download begins. See our{' '}
              <Link href="/terms" className="underline hover:text-zinc-400">Terms</Link>.
            </p>
          </div>
        )}

        {/* Stage: Preparing */}
        {stage === 'preparing' && (
          <div className="p-12 text-center mt-20">
            <div className="inline-block w-12 h-12 border-4 border-zinc-800 border-t-orange-600 rounded-full animate-spin mb-6" />
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2">Finalising</p>
            <h2 className="text-xl font-black mb-2 font-display">Adding to your collection...</h2>
            <p className="text-zinc-500 text-sm font-medium">This usually takes a few seconds.</p>
          </div>
        )}

        {/* Stage: Confirmed */}
        {(stage === 'confirmed' || stage === 'consent' || stage === 'download') && (
          <div className="p-6 md:p-8 mt-8">
            <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-orange-600/15 border border-orange-600/40 flex items-center justify-center">
              <svg width="24" height="24" fill="none" stroke="#F56D00" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2 text-center">Payment received — thank you</p>
            <h2 className="text-2xl font-black mb-4 font-display text-center">Added to your collection</h2>

            {basketHadReleases && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Music</p>
                <p className="text-sm text-zinc-300">Your music is ready to listen to and download from your library.</p>
              </div>
            )}

            {basketHadMerch && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Merch</p>
                {merchOrderNames.map((name, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-green-500 shrink-0">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span className="text-sm font-semibold text-white">{name}</span>
                  </div>
                ))}
                <p className="text-[11px] text-zinc-500 font-medium mt-2">You&apos;ll be notified when it ships.</p>
              </div>
            )}

            <Link
              href="/library"
              onClick={handleClose}
              className="w-full mt-4 bg-orange-600 hover:bg-orange-500 text-black font-black py-4 rounded-2xl text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
            >
              Go to my library
            </Link>
            <p className="text-center text-[11px] text-zinc-600 font-medium mt-3">A receipt has been sent by Stripe.</p>
          </div>
        )}

        {/* Stage: Error */}
        {stage === 'error' && (
          <div className="p-12 text-center mt-20">
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2">Something&apos;s off</p>
            <h2 className="text-xl font-black mb-2 font-display">{errorTitle}</h2>
            <p className="text-zinc-500 text-sm font-medium mb-6">{errorMsg}</p>
            <button onClick={handleClose} className="bg-orange-600 hover:bg-orange-500 text-black font-black px-6 py-3 rounded-xl text-sm transition-colors">Close</button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Basket summary with fee breakdown ───────────────────────── */

function BasketSummary({ items, itemsTotal, postageTotal, total, hasMerch, openCheckout }: {
  items: BasketItem[]
  itemsTotal: () => number
  postageTotal: () => number
  total: () => number
  hasMerch: () => boolean
  openCheckout: () => void
}) {
  const { currency, formatPrice, convertPrice } = useCurrency()
  const baseCurrency = items[0]?.currency || 'GBP'

  const totalPence = total()
  const fees = calculateFeesPence(itemsTotal())
  const artistGetsPence = fees.artistReceived + postageTotal()

  const uniqueArtists = [...new Set(items.map(i => i.artistName))]
  const artistLabel = uniqueArtists.length === 1 ? `To ${uniqueArtists[0]}` : `To ${uniqueArtists.length} artists`

  return (
    <div className="border-t border-zinc-800 pt-4 mt-4">
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-zinc-400">Subtotal</span>
          <span className="text-sm font-bold text-white">
            {formatPrice(convertPrice(itemsTotal() / 100, baseCurrency, currency))}
          </span>
        </div>
        {postageTotal() > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-400">P&amp;P</span>
            <span className="text-sm font-bold text-white">
              {formatPrice(convertPrice(postageTotal() / 100, baseCurrency, currency))}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <span className="text-sm font-bold text-zinc-400">Total</span>
          <span className="text-xl font-black text-orange-600">
            {formatPrice(convertPrice(totalPence / 100, baseCurrency, currency))}
          </span>
        </div>
      </div>

      {/* Fee breakdown */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3 mb-5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 font-medium">{artistLabel}</span>
          <span className="text-[11px] text-white font-bold">
            {formatPrice(convertPrice(artistGetsPence / 100, baseCurrency, currency))}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 font-medium">Insound fee (10%)</span>
          <span className="text-[11px] text-zinc-400 font-medium">
            {formatPrice(convertPrice(fees.insoundFee / 100, baseCurrency, currency))}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 font-medium">Stripe fee (20p + 1.5%)</span>
          <span className="text-[11px] text-zinc-400 font-medium">
            {formatPrice(convertPrice(fees.stripeFee / 100, baseCurrency, currency))}
          </span>
        </div>
      </div>

      {hasMerch() && (
        <p className="text-[11px] text-zinc-500 font-medium mb-3">Shipping address collected at checkout.</p>
      )}

      <button
        onClick={openCheckout}
        className="w-full bg-orange-600 hover:bg-orange-500 text-black font-black py-4 rounded-2xl text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4-5M7 13l-2 6h12" />
          <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
        </svg>
        Checkout
      </button>
      <p className="text-center text-[10px] text-zinc-600 mt-3">
        {hasMerch()
          ? 'Music added to your collection after payment. Merch dispatched by the artist.'
          : 'Added to your collection and available for download after payment.'}
      </p>
    </div>
  )
}
