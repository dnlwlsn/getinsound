'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useCurrency } from '../providers/CurrencyProvider'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://rvsfriqjobwuzzfdiyxg.supabase.co'
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_m2T7SpX_nYsK9i9CC3aDDw_SFeOtEUg'

const TUNECORE_FEE = 43.99
const SPOTIFY_RATE = 0.0031
const PLATFORM_CUT = 0.10
const STRIPE_PCT = 0.015
const STRIPE_FIXED = 0.20

const isValidEmail = (e: string) => !!e && /\S+@\S+\.\S+/.test(e)

function calcProfit(price: number) {
  return Math.max(0, price - price * PLATFORM_CUT - (price * STRIPE_PCT + STRIPE_FIXED))
}

export function WhyUsClient() {
  const { currency, formatPrice, convertPrice } = useCurrency()
  const [price, setPrice] = useState(10)
  const [email, setEmail] = useState('')
  const [stickyEmail, setStickyEmail] = useState('')
  const [phase, setPhase] = useState<'form' | 'success'>('form')
  const [invalid, setInvalid] = useState(false)
  const [stickyInvalid, setStickyInvalid] = useState(false)
  const [sending, setSending] = useState(false)
  const [stickySending, setStickySending] = useState(false)
  const [stickyVisible, setStickyVisible] = useState(false)
  const [stickyDismissed, setStickyDismissed] = useState(false)

  const barRef = useRef<HTMLDivElement>(null)

  const profit = useMemo(() => calcProfit(price), [price])
  const streamsNeeded = useMemo(
    () => Math.ceil((TUNECORE_FEE + profit) / SPOTIFY_RATE),
    [profit]
  )
  const streamsAlert = streamsNeeded > 20000

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('insound_interested')) setPhase('success')
    if (sessionStorage.getItem('insound_bar_dismissed')) setStickyDismissed(true)
  }, [])

  useEffect(() => {
    if (stickyDismissed || phase === 'success') return
    const onScroll = () => {
      const pct = window.scrollY / ((document.body.scrollHeight - window.innerHeight) || 1)
      if (pct > 0.35) setStickyVisible(true)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [stickyDismissed, phase])

  function submit(which: 'main' | 'sticky') {
    const value = which === 'main' ? email : stickyEmail
    const setSend = which === 'main' ? setSending : setStickySending
    const setBad = which === 'main' ? setInvalid : setStickyInvalid
    if (!isValidEmail(value)) { setBad(true); return }
    setBad(false); setSend(true)
    fetch(`${SB_URL}/rest/v1/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Prefer: 'return=minimal' },
      body: JSON.stringify({ email: value }),
    }).then(r => {
      if (r.ok || r.status === 409) {
        setPhase('success')
        localStorage.setItem('insound_interested', '1')
        sessionStorage.setItem('insound_bar_dismissed', '1')
      }
    }).finally(() => setSend(false))
  }

  function dismissSticky() {
    setStickyVisible(false)
    setStickyDismissed(true)
    sessionStorage.setItem('insound_bar_dismissed', '1')
  }

  return (
    <main className="bg-[#0A0A0A] text-white min-h-screen pb-32">

      {/* ── NAV ──────────────────────────────────────────────────── */}
      <nav className="sticky top-0 w-full z-40 flex justify-between items-center px-6 md:px-14 py-5 border-b border-zinc-900/80" style={{ background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <Link href="/" className="font-display text-2xl font-black text-orange-600 tracking-tighter hover:text-orange-500 transition-colors">insound.</Link>
        <div className="hidden md:flex gap-10 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
          <Link href="/explore" className="hover:text-orange-500 transition-colors">Explore</Link>
          <Link href="/why-us" className="text-orange-500">Why Insound</Link>
          <Link href="/#how-it-works" className="hover:text-orange-500 transition-colors">How It Works</Link>
        </div>
        <div className="flex gap-3 items-center">
          <Link href="/auth" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors hidden sm:block">Sign In</Link>
          <Link href="/#signup" className="bg-orange-600 text-black px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition-colors shadow-lg shadow-orange-600/20">Join the Waitlist</Link>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <header className="max-w-5xl mx-auto px-8 py-24 text-center relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(234,88,12,0.08),transparent)] pointer-events-none" />
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2.5 bg-orange-600/10 text-orange-500 text-[10px] font-black px-4 py-2 rounded-full border border-orange-600/20 mb-8 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            The math doesn&apos;t lie
          </span>
          <h1 className="font-display text-6xl md:text-8xl font-black tracking-tighter mb-6 italic">The <span className="text-orange-600">Industry</span> is Broken.</h1>
          <p className="text-zinc-400 text-xl max-w-2xl mx-auto leading-relaxed">
            Most distributors charge you for the &ldquo;privilege&rdquo; of making them money. We flipped the script. Here is the cold, hard math.
          </p>
        </div>
      </header>

      {/* ── TOP STATS ────────────────────────────────────────────── */}
      <div className="border-y border-zinc-900 bg-zinc-950 py-6">
        <div className="max-w-5xl mx-auto px-8">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-2xl md:text-3xl font-black text-orange-600">10%</p><p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1">Our cut, all-in</p></div>
            <div><p className="text-2xl md:text-3xl font-black">{formatPrice(0)}</p><p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1">Annual fee</p></div>
            <div><p className="text-2xl md:text-3xl font-black">Instant</p><p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1">Payouts</p></div>
          </div>
        </div>
      </div>

      {/* ── CALCULATOR ───────────────────────────────────────────── */}
      <section className="py-24 bg-black border-y border-zinc-900">
        <div className="max-w-5xl mx-auto px-8">
          <div className="bg-zinc-900 rounded-[3rem] border border-zinc-800 p-10 md:p-16 shadow-2xl">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-12">
                <div>
                  <div className="flex justify-between items-end mb-6">
                    <label htmlFor="priceSlider" className="text-xs font-black uppercase tracking-widest text-zinc-400">If you sell one album for:</label>
                    <span className="text-4xl font-black text-orange-600">{formatPrice(price)}</span>
                  </div>
                  <input
                    id="priceSlider"
                    type="range"
                    min={5}
                    max={100}
                    step={1}
                    value={price}
                    onChange={e => setPrice(parseInt(e.target.value, 10))}
                    className="w-full h-3 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-orange-600 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_20px_rgba(234,88,12,0.4)]"
                  />
                  <div className="flex justify-between mt-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                    <span>{formatPrice(convertPrice(5, 'GBP', currency))} min</span>
                    <span>{formatPrice(convertPrice(100, 'GBP', currency))} max</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-black/40 rounded-xl border border-zinc-800">
                    <span className="text-xs text-zinc-400">Insound platform fee</span>
                    <span className="text-zinc-300 font-black">10%</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-black/40 rounded-xl border border-zinc-800">
                    <span className="text-xs text-zinc-400">Stripe processing</span>
                    <span className="text-zinc-300 font-black">Stripe&apos;s standard processing fee</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-black/40 rounded-xl border border-zinc-800">
                    <span className="text-xs text-zinc-400">TuneCore annual fee</span>
                    <span className="text-red-500 font-black">{formatPrice(convertPrice(43.99, 'GBP', currency))}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-black/40 rounded-xl border border-zinc-800">
                    <span className="text-xs text-zinc-400">Avg. Spotify payout</span>
                    <span className="text-white font-black">{currency === 'GBP' ? '£0.003' : formatPrice(convertPrice(0.003, 'GBP', currency))}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-orange-600 p-8 rounded-3xl shadow-xl shadow-orange-600/20">
                  <p className="text-[10px] font-black text-emerald-950 uppercase tracking-widest mb-1">Your Insound profit</p>
                  <p className="text-6xl font-black text-black">{formatPrice(profit)}</p>
                  <p className="mt-4 text-[10px] text-emerald-900 font-bold italic">After our flat 10% and Stripe&apos;s standard processing fee. Paid instantly. No annual subscription.</p>
                </div>

                <div className="bg-zinc-800 p-8 rounded-3xl border border-zinc-700">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-6">To match this on Spotify, you need:</p>
                  <div className="space-y-6">
                    <div>
                      <p className={`text-4xl font-black ${streamsAlert ? 'text-red-500' : 'text-white'}`}>{streamsNeeded.toLocaleString()}</p>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1 italic">Streams to cover fee + match profit</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-zinc-800/50 text-center">
              <p className="text-zinc-500 text-sm italic leading-relaxed">
                &ldquo;On streaming, your first <span className="text-white font-bold">14,191 streams</span> every year simply pay for your <br className="hidden md:block" /> {formatPrice(convertPrice(43.99, 'GBP', currency))} distribution fee. On <span className="text-orange-600 font-bold">insound.</span>, you&apos;re profitable from sale #1.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ─────────────────────────────────────── */}
      <section className="py-24 bg-zinc-950">
        <div className="max-w-5xl mx-auto px-8">
          <div className="text-center mb-16">
            <h3 className="font-display text-2xl font-black italic mb-4 text-white">The Fine Print Comparison</h3>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Calculated for a UK-based Independent Artist</p>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-zinc-900 bg-zinc-900/50">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="p-8 text-[10px] font-black uppercase tracking-widest text-zinc-500">Feature</th>
                  <th className="p-8 text-[10px] font-black uppercase tracking-widest text-orange-600 bg-orange-600/5">insound.</th>
                  <th className="p-8 text-[10px] font-black uppercase tracking-widest text-zinc-500">The &ldquo;Machine&rdquo;</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-zinc-800">
                  <td className="p-8 font-bold text-zinc-300">Annual subscription</td>
                  <td className="p-8 font-black text-white bg-orange-600/5">{formatPrice(0)}</td>
                  <td className="p-8 text-red-500 font-bold">{formatPrice(convertPrice(43.99, 'GBP', currency))} <span className="text-[10px] block opacity-50 font-normal underline">via TuneCore</span></td>
                </tr>
                <tr className="border-b border-zinc-800">
                  <td className="p-8 font-bold text-zinc-300">Commission / fee</td>
                  <td className="p-8 font-black text-white bg-orange-600/5">10% flat <span className="text-[10px] block opacity-60 font-normal italic">Stripe processing shown at checkout</span></td>
                  <td className="p-8 text-zinc-400">0%* <span className="text-[10px] block opacity-50 font-normal italic">*Plus hidden admin fees</span></td>
                </tr>
                <tr className="border-b border-zinc-800">
                  <td className="p-8 font-bold text-zinc-300">Payout delay</td>
                  <td className="p-8 font-black text-orange-500 bg-orange-600/5">Instant</td>
                  <td className="p-8 text-red-900 font-bold">90 &ndash; 120 days</td>
                </tr>
                <tr className="border-b border-zinc-800">
                  <td className="p-8 font-bold text-zinc-300">Withdrawal cost</td>
                  <td className="p-8 font-black text-white bg-orange-600/5">Free</td>
                  <td className="p-8 text-red-500 font-bold">{formatPrice(convertPrice(1.5, 'GBP', currency))} <span className="text-[10px] block opacity-50 font-normal">Per bank transfer</span></td>
                </tr>
                <tr>
                  <td className="p-8 font-bold text-zinc-300">Content take-down fee</td>
                  <td className="p-8 font-black text-white bg-orange-600/5">Free</td>
                  <td className="p-8 text-red-500 font-bold">{formatPrice(convertPrice(10, 'GBP', currency))}+ <span className="text-[10px] block opacity-50 font-normal">On some platforms</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8 p-6 bg-zinc-900/30 border border-zinc-800 rounded-2xl text-center">
            <p className="text-zinc-500 text-xs leading-relaxed">
              <span className="text-white font-bold">The bottom line:</span> On streaming services, you don&apos;t just need fans; you need <span className="italic underline decoration-red-500">thousands</span> of fans just to pay for the &ldquo;privilege&rdquo; of being listed. On <span className="text-orange-600 font-bold uppercase tracking-tighter">insound</span>, your first supporter puts you in profit.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="py-24 bg-black relative overflow-hidden">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-64 bg-orange-600/10 blur-[120px] -z-10" />

        <div className="max-w-4xl mx-auto px-8 text-center">
          <h2 className="font-display text-5xl md:text-7xl font-black tracking-tighter mb-8 italic">
            Stop paying for the <br />
            <span className="text-orange-600">privilege</span> of being heard.
          </h2>
          <p className="text-zinc-400 text-xl mb-12 max-w-xl mx-auto">
            Join a community that values the creator over the corporation. Set up your artist profile in under two minutes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link href="/auth" className="w-full sm:w-auto bg-orange-600 text-black font-black px-12 py-5 rounded-2xl shadow-xl shadow-orange-600/20 hover:scale-105 transition-transform text-center">
              Get Started Now
            </Link>
            <Link href="/explore" className="w-full sm:w-auto bg-zinc-900 border border-zinc-800 text-white font-black px-12 py-5 rounded-2xl hover:bg-zinc-800 transition-colors text-center">
              Browse the Shop
            </Link>
          </div>

          <p className="mt-10 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600">
            No annual fees. No hidden costs. 10% platform fee. Every fee shown at checkout.
          </p>
        </div>
      </section>

      {/* ── REGISTER INTEREST ────────────────────────────────────── */}
      <section className="py-24 bg-zinc-950 border-t border-zinc-900">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-orange-600/10 border border-orange-600/20 rounded-full px-4 py-2 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Early Access Open</span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-black tracking-tighter mb-4">Be first in line.</h2>
          <p className="text-zinc-400 mb-10 max-w-sm mx-auto leading-relaxed">Register your interest and get priority access, a founding member badge, and your founding rate locked in forever — before we open to everyone.</p>

          {phase === 'form' ? (
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-5">
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (invalid) setInvalid(false) }}
                onKeyDown={e => { if (e.key === 'Enter') submit('main') }}
                placeholder="your@email.com"
                className={`flex-1 bg-zinc-900 border ${invalid ? 'border-red-500' : 'border-zinc-800 focus:border-orange-600'} focus:outline-none rounded-xl px-4 py-4 text-sm font-medium text-white placeholder-zinc-600 transition-colors`}
              />
              <button
                onClick={() => submit('main')}
                disabled={sending}
                className="bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-black font-black px-7 py-4 rounded-xl text-sm transition-colors whitespace-nowrap shadow-lg shadow-orange-600/20"
              >
                {sending ? 'Sending…' : 'Register →'}
              </button>
            </div>
          ) : (
            <div className="mb-5">
              <div className="inline-flex items-center gap-3 bg-orange-600/10 border border-orange-600/20 rounded-xl px-6 py-4">
                <svg width="16" height="16" fill="none" stroke="#ea580c" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                <span className="text-orange-500 font-black text-sm">You&apos;re on the list. We&apos;ll be in touch.</span>
              </div>
            </div>
          )}

          <p className="text-zinc-600 text-xs font-medium">No spam, ever &nbsp;&middot;&nbsp; Unsubscribe anytime &nbsp;&middot;&nbsp; <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link></p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="py-20 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-12">
            <div className="text-center md:text-left">
              <div className="font-display text-2xl font-black text-orange-600 tracking-tighter mb-2">insound.</div>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest italic">The math of independence.</p>
            </div>

            <div className="flex flex-wrap justify-center gap-10 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
              <Link href="/" className="hover:text-orange-500 transition">Home</Link>
              <Link href="/why-us" className="text-white">Why Us?</Link>
              <Link href="/explore" className="hover:text-orange-500 transition">Explore</Link>
              <Link href="/auth" className="hover:text-orange-500 transition">Artist Login</Link>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-zinc-900/50 flex flex-col md:flex-row justify-between items-center gap-4 text-[9px] font-black uppercase tracking-widest text-zinc-700">
            <p>&copy; 2026 INSOUND MUSIC LTD &bull; BUILT IN THE UK</p>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:text-zinc-400 transition">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ── STICKY REGISTER BAR ──────────────────────────────────── */}
      <div
        ref={barRef}
        className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 px-5 py-3.5"
        style={{ transform: stickyVisible && !stickyDismissed && phase === 'form' ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.5s cubic-bezier(0.16,1,0.3,1)' }}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-4 flex-wrap sm:flex-nowrap">
          <div className="hidden sm:block flex-1 min-w-0">
            <p className="font-black text-sm text-white">Get early access to Insound</p>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Founding member rates locked forever</p>
          </div>
          <div className="flex gap-2 flex-1 sm:flex-initial">
            <input
              type="email"
              value={stickyEmail}
              onChange={e => { setStickyEmail(e.target.value); if (stickyInvalid) setStickyInvalid(false) }}
              onKeyDown={e => { if (e.key === 'Enter') submit('sticky') }}
              placeholder="your@email.com"
              className={`flex-1 sm:w-52 bg-zinc-800 border ${stickyInvalid ? 'border-red-500' : 'border-zinc-700 focus:border-orange-600'} focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 transition-colors`}
            />
            <button
              onClick={() => submit('sticky')}
              disabled={stickySending}
              className="bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-black font-black px-5 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap shadow-lg shadow-orange-600/20"
            >
              {stickySending ? 'Sending…' : 'Register →'}
            </button>
          </div>
          <button onClick={dismissSticky} className="text-zinc-600 hover:text-zinc-400 flex-shrink-0 p-1" aria-label="Dismiss">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
    </main>
  )
}
