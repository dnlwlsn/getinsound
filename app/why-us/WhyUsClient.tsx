'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { InsoundLogo } from '@/app/components/ui/InsoundLogo'
import { useCurrency } from '../providers/CurrencyProvider'


const TUNECORE_FEE = 43.99
const SPOTIFY_RATE = 0.0031
const PLATFORM_CUT = 0.10
const STRIPE_PCT = 0.015
const STRIPE_FIXED = 0.20

function calcProfit(price: number) {
  return Math.max(0, price - price * PLATFORM_CUT)
}

export function WhyUsClient() {
  const { currency, formatPrice, convertPrice } = useCurrency()
  const [price, setPrice] = useState(10)

  const profit = useMemo(() => calcProfit(price), [price])
  const streamsNeeded = useMemo(
    () => Math.ceil((TUNECORE_FEE + profit) / SPOTIFY_RATE),
    [profit]
  )
  const streamsAlert = streamsNeeded > 20000

  return (
    <main className="bg-zinc-950 text-white min-h-screen pb-32">

      {/* ── NAV ──────────────────────────────────────────────────── */}
      <nav className="sticky top-0 w-full z-40 flex justify-between items-center px-6 md:px-14 py-5 border-b border-zinc-900/80" style={{ background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <InsoundLogo size="lg" />
        <div className="hidden md:flex gap-10 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
          <Link href="/explore" className="hover:text-orange-500 transition-colors">Explore</Link>
          <Link href="/why-us" className="text-orange-500">Why Insound</Link>
          <Link href="/#how-it-works" className="hover:text-orange-500 transition-colors">How It Works</Link>
        </div>
        <div className="flex gap-3 items-center">
          <Link href="/auth" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors hidden sm:block">Sign In</Link>
          <Link href="/become-an-artist" className="bg-orange-600 text-black px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition-colors shadow-lg shadow-orange-600/20">Start Selling</Link>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <header className="max-w-5xl mx-auto px-8 py-24 text-center relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(245,109,0,0.08),transparent)] pointer-events-none" />
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
            <div><p className="text-2xl md:text-3xl font-black text-orange-600">90%</p><p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1">Artists keep</p></div>
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
                    className="w-full h-3 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-orange-600 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_20px_rgba(245,109,0,0.4)]"
                  />
                  <div className="flex justify-between mt-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                    <span>{formatPrice(convertPrice(5, 'GBP', currency))} min</span>
                    <span>{formatPrice(convertPrice(100, 'GBP', currency))} max</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-black/40 rounded-xl border border-zinc-800">
                    <span className="text-xs text-zinc-400">Insound platform fee</span>
                    <span className="text-zinc-300 font-black">10% <span className="text-[10px] text-zinc-500 font-normal">(incl. Stripe processing)</span></span>
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
                  <p className="mt-4 text-[10px] text-emerald-900 font-bold italic">After our flat 10% — we absorb all processing fees. Paid instantly. No annual subscription.</p>
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
                  <td className="p-8 font-black text-white bg-orange-600/5">10% flat <span className="text-[10px] block opacity-60 font-normal italic">Stripe processing absorbed by us</span></td>
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
            No annual fees. No hidden costs. Artists keep 90% - we absorb all processing fees.
          </p>
        </div>
      </section>

      {/* ── GET STARTED ─────────────────────────────────────────── */}
      <section className="py-24 bg-zinc-950 border-t border-zinc-900">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-orange-600/10 border border-orange-600/20 rounded-full px-4 py-2 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Open Now</span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-black tracking-tighter mb-4">Ready to get started?</h2>
          <p className="text-zinc-400 mb-10 max-w-sm mx-auto leading-relaxed">Set up your artist profile in under two minutes. Founding members get a permanent reduced rate — 7.5% instead of 10%.</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/become-an-artist" className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-black font-black px-10 py-4 rounded-xl text-sm transition-colors shadow-lg shadow-orange-600/20">
              Start Selling Today
            </Link>
            <Link href="/explore" className="w-full sm:w-auto bg-zinc-900 border border-zinc-800 text-white font-black px-10 py-4 rounded-xl text-sm hover:bg-zinc-800 transition-colors">
              Discover Music
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="py-20 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-12">
            <div className="text-center md:text-left">
              <InsoundLogo size="lg" className="mb-2" />
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

    </main>
  )
}
