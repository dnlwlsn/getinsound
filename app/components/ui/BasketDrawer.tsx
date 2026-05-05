'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { useBasketStore, type BasketItem, type PriceChange } from '@/lib/stores/basket'
import { useCurrency } from '@/app/providers/CurrencyProvider'
import { createClient } from '@/lib/supabase/client'
import { calculateFeesPence } from '@/app/lib/fees'
import Link from 'next/link'
import Image from 'next/image'
import { stripePromise } from '@/lib/stripe'

type Stage = 'review' | 'checkout' | 'preparing' | 'consent' | 'download' | 'confirmed' | 'finalising' | 'error'

interface Props {
  onClose: () => void
}

export function BasketDrawer({ onClose }: Props) {
  const { items, remove, updateCustomAmount, applyPriceChanges, clear, total, itemsTotal, postageTotal, hasMerch } = useBasketStore()
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
  const [wasGuest, setWasGuest] = useState(false)
  const sessionIdRef = useRef<string | null>(null)
  const stripeRef = useRef<any>(null)
  const stripeMountRef = useRef<HTMLDivElement>(null)
  const embeddedCheckoutRef = useRef<any>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const handleCloseRef = useRef<() => void>(() => onClose())

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
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCloseRef.current() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
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

  handleCloseRef.current = handleClose

  const mountSession = useCallback(async (stripe: any, clientSecret: string, sessionId: string) => {
    if (embeddedCheckoutRef.current) {
      try { embeddedCheckoutRef.current.destroy() } catch {}
      embeddedCheckoutRef.current = null
    }
    if (stripeMountRef.current) stripeMountRef.current.innerHTML = ''

    sessionIdRef.current = sessionId

    const embedded = await stripe.createEmbeddedCheckoutPage({
      clientSecret,
      onComplete: () => {
        pollForDownloads(sessionId)
      },
    })
    embeddedCheckoutRef.current = embedded

    requestAnimationFrame(() => {
      if (stripeMountRef.current) embedded.mount(stripeMountRef.current)
    })
  }, [clear])

  const openCheckout = useCallback(async () => {
    if (items.length === 0) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user && !user.email_confirmed_at) {
      setErrorTitle('Email not verified')
      setErrorMsg('verify_email')
      setStage('error')
      return
    }

    setWasGuest(!user)
    setStage('checkout')

    // Capture basket composition before checkout
    const hadReleases = items.some(i => i.type === 'release')
    const hadMerch = items.some(i => i.type === 'merch')
    const merchNames = items.filter(i => i.type === 'merch').map(i => (i as any).merchName as string)
    setBasketHadReleases(hadReleases)
    setBasketHadMerch(hadMerch)
    setMerchOrderNames(merchNames)

    try {
      const stripe = await stripePromise
      if (!stripe) throw new Error('Failed to load payment system.')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const requestBody = {
        items: items.map(i =>
          i.type === 'merch'
            ? { type: 'merch', merch_id: i.merchId, variant: i.variant ?? undefined }
            : { type: 'release', release_id: i.releaseId, custom_amount: i.customAmountPence }
        ),
        fan_currency: currency,
        origin: window.location.origin,
      }

      let data: any
      if (session?.access_token) {
        const res = await supabase.functions.invoke('checkout-basket-create', { body: requestBody })
        if (res.error) throw res.error
        data = res.data
      } else {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        const res = await fetch(`${supabaseUrl}/functions/v1/checkout-basket-create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify(requestBody),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `Checkout failed (${res.status})`)
        }
        data = await res.json()
      }
      if (!data?.sessions || data.sessions.length === 0) throw new Error('No checkout session returned')

      const { client_secret, session_id } = data.sessions[0]
      stripeRef.current = stripe
      await mountSession(stripe, client_secret, session_id)
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
          setStage('confirmed')
          clear()
          return
        }
        if (data && data.release) {
          setDownloadTracks([{ releaseTitle: data.release.title, tracks: data.tracks }])
          setDigitalConsent(false)
          setStage('confirmed')
          clear()
          return
        }
        let body: any = null
        try { body = await error?.context?.response?.json?.() } catch {}
        if (body && body.error !== 'pending') throw new Error(body.error || 'Could not load downloads')
      } catch (err) {
        if (i === maxAttempts - 1) {
          setErrorTitle('Still finalising...')
          setErrorMsg("Your payment went through but the downloads aren't ready yet. Check your library in a moment.")
          setStage('finalising')
          clear()
          return
        }
      }
      await new Promise((r) => setTimeout(r, 1500))
    }
    setErrorTitle('Still finalising...')
    setErrorMsg("Your payment went through but the downloads aren't ready yet. Check your library in a moment.")
    setStage('finalising')
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
                          const effectivePence = item.customAmountPence ?? item.pricePence
                          const displayPrice = formatPrice(convertPrice(effectivePence / 100, artistCurrency, currency))
                          const minPence = item.pwyw ? (item.pwywMinimumPence ?? item.pricePence) : item.pricePence
                          return (
                            <div key={item.releaseId} className="py-2 px-3 rounded-xl hover:bg-zinc-900 transition-colors">
                              <div className="flex items-center gap-3">
                                <Link href={`/release?a=${item.artistSlug}&r=${item.releaseSlug}`} className="relative w-10 h-10 rounded shrink-0 overflow-hidden bg-zinc-900">
                                  {item.coverUrl ? (
                                    <Image src={item.coverUrl} fill className="object-cover" sizes="40px" alt={item.releaseTitle} />
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
                                  className="shrink-0 p-2.5 text-zinc-600 hover:text-red-400 transition-colors"
                                  aria-label={`Remove ${item.releaseTitle}`}
                                >
                                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                              {item.pwyw && (
                                <PwywInlineEditor
                                  releaseId={item.releaseId}
                                  currentPence={effectivePence}
                                  minPence={minPence}
                                  relCurrency={artistCurrency}
                                  onUpdate={updateCustomAmount}
                                />
                              )}
                            </div>
                          )
                        }

                        // Merch item
                        const displayPrice = formatPrice(convertPrice(item.pricePence / 100, artistCurrency, currency))
                        const postageFormatted = item.postagePence > 0
                          ? formatPrice(convertPrice(item.postagePence / 100, artistCurrency, currency))
                          : null
                        return (
                          <div key={`${item.merchId}-${item.variant}`} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-zinc-900 transition-colors">
                            <Link href={`/${item.artistSlug}/merch/${item.merchId}`} className="relative w-10 h-10 rounded shrink-0 overflow-hidden bg-zinc-900">
                              {item.photoUrl ? (
                                <Image src={item.photoUrl} fill className="object-cover" sizes="40px" alt={item.merchName} />
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

                <BasketSummary items={items} itemsTotal={itemsTotal} postageTotal={postageTotal} total={total} hasMerch={hasMerch} openCheckout={openCheckout} applyPriceChanges={applyPriceChanges} />
              </>
            )}
          </div>
        )}

        {/* Stage: Stripe checkout */}
        {stage === 'checkout' && (
          <div>
            <div className="px-6 pt-14 pb-3">
              <button
                onClick={() => {
                  if (embeddedCheckoutRef.current) {
                    try { embeddedCheckoutRef.current.destroy() } catch {}
                    embeddedCheckoutRef.current = null
                  }
                  if (stripeMountRef.current) stripeMountRef.current.innerHTML = ''
                  setStage('review')
                }}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-zinc-400 hover:text-white transition-colors"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back to basket
              </button>
            </div>
            <div ref={stripeMountRef} className="min-h-[400px] relative">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="inline-block w-10 h-10 border-4 border-zinc-800 border-t-orange-600 rounded-full animate-spin" />
              </div>
            </div>
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
        {stage === 'consent' && (
          <div className="p-6 md:p-8 mt-8 text-center">
            <div className="inline-block w-10 h-10 border-4 border-zinc-800 border-t-orange-600 rounded-full animate-spin mb-4" />
            <p className="text-sm text-zinc-400 font-medium">Preparing your downloads...</p>
          </div>
        )}

        {stage === 'download' && (
          <div className="p-6 md:p-8 mt-8">
            <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-orange-600/15 border border-orange-600/40 flex items-center justify-center">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-orange-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2 text-center">Ready to download</p>
            <h2 className="text-2xl font-black mb-4 font-display text-center">Your music is ready</h2>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 mb-4">
              <p className="text-sm text-zinc-300">Download links have been sent to your email. You can also download from your collection.</p>
            </div>
            <Link
              href="/library"
              onClick={handleClose}
              className="w-full mt-4 bg-orange-600 hover:bg-orange-500 text-black font-black py-4 rounded-2xl text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
            >
              Go to my collection
            </Link>
          </div>
        )}

        {stage === 'confirmed' && (
          <div className="p-6 md:p-8 mt-8">
            <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-orange-600/15 border border-orange-600/40 flex items-center justify-center">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-orange-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2 text-center">Payment received — thank you</p>
            <h2 className="text-2xl font-black mb-4 font-display text-center">Added to your collection</h2>

            {basketHadReleases && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Music</p>
                <p className="text-sm text-zinc-300">
                  {wasGuest
                    ? 'Check your email for a link to access your music.'
                    : 'Your music is ready to listen to and download from your collection.'}
                </p>
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

            {wasGuest ? (
              <>
                <button
                  onClick={handleClose}
                  className="w-full mt-4 bg-orange-600 hover:bg-orange-500 text-black font-black py-4 rounded-2xl text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                >
                  Done
                </button>
                <Link
                  href="/signup"
                  onClick={handleClose}
                  className="block text-center text-sm font-bold text-orange-500 hover:text-orange-400 mt-3 transition-colors"
                >
                  Create a free account to access your collection anytime
                </Link>
              </>
            ) : (
              <Link
                href="/library"
                onClick={handleClose}
                className="w-full mt-4 bg-orange-600 hover:bg-orange-500 text-black font-black py-4 rounded-2xl text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
              >
                Go to my collection
              </Link>
            )}
            <p className="text-center text-[11px] text-zinc-600 font-medium mt-3">
              {wasGuest
                ? 'A receipt and sign-in link have been sent to your email.'
                : 'A receipt has been sent by Stripe.'}
            </p>
          </div>
        )}

        {stage === 'finalising' && (
          <div className="p-12 text-center mt-20">
            <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-orange-600/15 border border-orange-600/40 flex items-center justify-center">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-orange-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2">Payment received</p>
            <h2 className="text-xl font-black mb-2 font-display">{errorTitle}</h2>
            <p className="text-zinc-400 text-sm font-medium mb-6">
              {wasGuest
                ? "Your payment went through. Check your email for a link to access your music."
                : errorMsg}
            </p>
            {wasGuest ? (
              <button onClick={handleClose} className="inline-block bg-orange-600 hover:bg-orange-500 text-black font-black px-6 py-3 rounded-xl text-sm transition-colors">Done</button>
            ) : (
              <a href="/library" className="inline-block bg-orange-600 hover:bg-orange-500 text-black font-black px-6 py-3 rounded-xl text-sm transition-colors">Go to your library</a>
            )}
          </div>
        )}

        {/* Stage: Error */}
        {stage === 'error' && (
          <div className="p-12 text-center mt-20">
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2">Something&apos;s off</p>
            <h2 className="text-xl font-black mb-2 font-display">{errorTitle}</h2>
            {errorMsg === 'verify_email' ? (
              <div className="mb-6">
                <p className="text-zinc-500 text-sm font-medium mb-4">Please verify your email before purchasing.</p>
                <button
                  onClick={async () => {
                    const supabase = createClient()
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user?.email) {
                      await supabase.auth.resend({ type: 'signup', email: user.email })
                      setErrorMsg('Verification email sent! Check your inbox, then try again.')
                    }
                  }}
                  className="text-orange-500 hover:text-orange-400 text-sm font-bold"
                >
                  Resend verification email
                </button>
              </div>
            ) : (
              <p className="text-zinc-500 text-sm font-medium mb-6">{errorMsg}</p>
            )}
            <button onClick={handleClose} className="bg-orange-600 hover:bg-orange-500 text-black font-black px-6 py-3 rounded-xl text-sm transition-colors">Close</button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Basket summary with fee breakdown ───────────────────────── */

function BasketSummary({ items, itemsTotal, postageTotal, total, hasMerch, openCheckout, applyPriceChanges }: {
  items: BasketItem[]
  itemsTotal: () => number
  postageTotal: () => number
  total: () => number
  hasMerch: () => boolean
  openCheckout: () => void
  applyPriceChanges: (changes: PriceChange[]) => void
}) {
  const { currency, formatPrice, convertPrice } = useCurrency()
  const [checking, setChecking] = useState(false)
  const [priceChanges, setPriceChanges] = useState<PriceChange[] | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)

  const feeCurrency = items[0]?.currency || 'GBP'
  const convertedSubtotal = items.reduce((sum, i) => {
    const pence = i.type === 'release' ? (i.customAmountPence ?? i.pricePence) : i.pricePence
    return sum + convertPrice(pence / 100, i.currency, currency)
  }, 0)
  const convertedPostage = items.reduce((sum, i) => {
    if (i.type === 'merch') return sum + convertPrice(i.postagePence / 100, i.currency, currency)
    return sum
  }, 0)
  const convertedTotal = convertedSubtotal + convertedPostage

  const fees = calculateFeesPence(itemsTotal())
  const artistGetsPence = fees.artistReceived + postageTotal()

  const uniqueArtists = [...new Set(items.map(i => i.artistName))]
  const artistLabel = uniqueArtists.length === 1 ? `To ${uniqueArtists[0]}` : `To ${uniqueArtists.length} artists`

  const handleCheckout = useCallback(async () => {
    setChecking(true)
    setPriceChanges(null)
    setCheckError(null)
    try {
      const supabase = createClient()
      const releaseIds = items.filter(i => i.type === 'release').map(i => (i as any).releaseId as string)
      const merchIds = items.filter(i => i.type === 'merch').map(i => (i as any).merchId as string)

      const [relRes, merchRes] = await Promise.all([
        releaseIds.length > 0
          ? supabase.from('releases').select('id, price_pence, pwyw_minimum_pence').in('id', releaseIds)
          : Promise.resolve({ data: [] as any[] }),
        merchIds.length > 0
          ? supabase.from('merch').select('id, price, postage').in('id', merchIds)
          : Promise.resolve({ data: [] as any[] }),
      ])

      const relMap = new Map((relRes.data || []).map((r: any) => [r.id, r]))
      const merchMap = new Map((merchRes.data || []).map((m: any) => [m.id, m]))

      const changes: PriceChange[] = []
      for (const item of items) {
        if (item.type === 'release') {
          const db = relMap.get(item.releaseId)
          if (db && db.price_pence !== item.pricePence) {
            changes.push({ item, oldPricePence: item.pricePence, newPricePence: db.price_pence })
          }
        } else if (item.type === 'merch') {
          const db = merchMap.get(item.merchId)
          if (db && (db.price !== item.pricePence || db.postage !== item.postagePence)) {
            changes.push({ item, oldPricePence: item.pricePence, newPricePence: db.price, oldPostagePence: item.postagePence, newPostagePence: db.postage })
          }
        }
      }

      if (changes.length > 0) {
        setPriceChanges(changes)
      } else {
        openCheckout()
      }
    } catch {
      setPriceChanges(null)
      setCheckError('Unable to verify prices. Please try again.')
    } finally {
      setChecking(false)
    }
  }, [items, openCheckout])

  const acceptPriceChanges = useCallback(() => {
    if (priceChanges) {
      applyPriceChanges(priceChanges)
      setPriceChanges(null)
      openCheckout()
    }
  }, [priceChanges, applyPriceChanges, openCheckout])

  return (
    <div className="border-t border-zinc-800 pt-4 mt-4">
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-zinc-400">Subtotal</span>
          <span className="text-sm font-bold text-white">
            {formatPrice(convertedSubtotal)}
          </span>
        </div>
        {convertedPostage > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-400">P&amp;P</span>
            <span className="text-sm font-bold text-white">
              {formatPrice(convertedPostage)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <span className="text-sm font-bold text-zinc-400">Total</span>
          <span className="text-xl font-black text-orange-600">
            {formatPrice(convertedTotal)}
          </span>
        </div>
      </div>

      {/* Fee breakdown */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3 mb-5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 font-medium">
            10% to Insound
            <span className="text-zinc-600 ml-1">(incl. {formatPrice(convertPrice(fees.stripeFee / 100, feeCurrency, currency))} Stripe fee)</span>
          </span>
          <span className="text-[11px] text-zinc-400 font-medium">
            {formatPrice(convertPrice(fees.insoundFee / 100, feeCurrency, currency))}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 font-medium">{artistLabel}</span>
          <span className="text-[11px] text-white font-bold">
            {formatPrice(convertPrice(artistGetsPence / 100, feeCurrency, currency))}
          </span>
        </div>
      </div>

      {/* Price change warning */}
      {priceChanges && priceChanges.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-700/50 rounded-xl px-4 py-3 mb-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-amber-500 mb-2">Prices updated</p>
          <p className="text-[12px] text-amber-200/80 mb-2">Some prices have changed since you added these items:</p>
          <ul className="space-y-1 mb-3">
            {priceChanges.map((c, i) => {
              const name = c.item.type === 'release' ? (c.item as any).releaseTitle : (c.item as any).merchName
              const oldDisplay = formatPrice(convertPrice(c.oldPricePence / 100, c.item.currency, currency))
              const newDisplay = formatPrice(convertPrice(c.newPricePence / 100, c.item.currency, currency))
              return (
                <li key={i} className="text-[12px] text-zinc-300">
                  <span className="font-semibold">{name}</span>{' '}
                  <span className="line-through text-zinc-500">{oldDisplay}</span>{' '}
                  <span className="text-amber-400 font-bold">{newDisplay}</span>
                </li>
              )
            })}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={acceptPriceChanges}
              className="flex-1 bg-amber-600 hover:bg-amber-500 text-black font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors"
            >
              Accept &amp; continue
            </button>
            <button
              onClick={() => setPriceChanges(null)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {hasMerch() && (
        <p className="text-[11px] text-zinc-500 font-medium mb-3">Shipping address collected at checkout.</p>
      )}

      {checkError && (
        <div className="bg-red-950/40 border border-red-700/50 rounded-xl px-4 py-3 mb-4">
          <p className="text-[12px] text-red-300 font-medium">{checkError}</p>
        </div>
      )}

      <button
        onClick={handleCheckout}
        disabled={checking}
        className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-orange-600/50 text-black font-black py-4 rounded-2xl text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
      >
        {checking ? (
          <>
            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            Checking prices...
          </>
        ) : (
          <>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4-5M7 13l-2 6h12" />
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
            </svg>
            Checkout
          </>
        )}
      </button>
      <p className="text-center text-[10px] text-zinc-600 mt-3">
        No account needed — just enter your email at checkout.
      </p>
    </div>
  )
}

/* ── PWYW inline editor for basket items ─────────────────────── */

function PwywInlineEditor({ releaseId, currentPence, minPence, relCurrency, onUpdate }: {
  releaseId: string
  currentPence: number
  minPence: number
  relCurrency: string
  onUpdate: (releaseId: string, amountPence: number) => void
}) {
  const { currency, formatPrice, convertPrice } = useCurrency()
  const [value, setValue] = useState((currentPence / 100).toFixed(2))
  const valuePence = Math.round(parseFloat(value || '0') * 100)
  const isValid = valuePence >= minPence

  const commit = () => {
    if (isValid && valuePence !== currentPence) {
      onUpdate(releaseId, valuePence)
    } else if (!isValid) {
      setValue((currentPence / 100).toFixed(2))
    }
  }

  return (
    <div className="flex items-center gap-2 mt-1.5 ml-[52px]">
      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Pay</span>
      <button
        type="button"
        onClick={() => {
          const next = Math.max(minPence / 100, parseFloat(value || '0') - 1)
          setValue(next.toFixed(2))
          onUpdate(releaseId, Math.round(next * 100))
        }}
        className="w-8 h-8 rounded flex items-center justify-center bg-zinc-800 text-zinc-400 hover:text-white text-xs font-black transition-colors"
        aria-label="Decrease price"
      >
        −
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => {
          const v = e.target.value
          if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setValue(v)
        }}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit() }}
        className="w-14 text-center text-xs font-bold bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-orange-500 outline-none focus:border-orange-600 transition-colors"
      />
      <button
        type="button"
        onClick={() => {
          const next = parseFloat(value || '0') + 1
          setValue(next.toFixed(2))
          onUpdate(releaseId, Math.round(next * 100))
        }}
        className="w-8 h-8 rounded flex items-center justify-center bg-zinc-800 text-zinc-400 hover:text-white text-xs font-black transition-colors"
        aria-label="Increase price"
      >
        +
      </button>
      <span className="text-[10px] text-zinc-600 font-medium">{relCurrency}</span>
      {!isValid && <span className="text-[10px] text-red-400">min {formatPrice(convertPrice(minPence / 100, relCurrency, currency))}</span>}
    </div>
  )
}
