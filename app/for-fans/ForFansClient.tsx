'use client'

import Link from 'next/link'
import Image from 'next/image'
import { InsoundLogo } from '@/app/components/ui/InsoundLogo'
import { useCurrency } from '../providers/CurrencyProvider'

const WHY_HERE = [
  { title: 'No labels', desc: 'Independent & unsigned only.' },
  { title: 'No algorithms', desc: 'Your money goes to the artist you choose.' },
  { title: 'No subscription', desc: 'Pay for music you actually want.' },
  { title: 'Pay what you want', desc: 'Pay more if you love it.' },
  { title: 'No hidden fees', desc: "Artists keep 90%. We absorb all processing fees." },
  { title: 'Permanent model', desc: 'No shareholders to answer to.' },
]

export function ForFansClient() {
  const { currency, formatPrice, convertPrice } = useCurrency()

  return (
    <main className="bg-zinc-950 text-white min-h-screen">

      {/* ── NAV ──────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div id="navInner" className="mx-4 mt-4 px-5 py-3 rounded-2xl ring-1 ring-white/[0.05] flex items-center justify-between">
          <InsoundLogo size="sm" />
          <Link href="/" className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">← Back</Link>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="pt-40 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 bg-orange-600/10 ring-1 ring-orange-600/20 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-10">
            For Fans
          </span>
          <h1 className="font-display font-bold tracking-[-0.04em] leading-[0.88] mb-6"
            style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)' }}>
            Your {formatPrice(convertPrice(10, 'GBP', currency))} can change<br />an artist&apos;s <span className="text-orange-500">year.</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-lg mx-auto leading-relaxed">
            Most streaming platforms make supporting artists nearly impossible.
          </p>
        </div>
      </section>

      {/* ── COMPARISON ───────────────────────────────────────────── */}
      <section className="pb-24 px-6">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
          {/* Streaming */}
          <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl p-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400/70 mb-4">Stream on Spotify</p>
            <p className="font-display text-3xl font-bold tracking-tight text-red-400 mb-2">{currency === 'GBP' ? '£0.003' : formatPrice(convertPrice(0.003, 'GBP', currency))}</p>
            <p className="text-sm text-zinc-400 leading-relaxed">per stream. 333,000 streams to earn {formatPrice(convertPrice(1000, 'GBP', currency))}.</p>
          </div>
          {/* Insound */}
          <div className="bg-orange-600/[0.06] ring-1 ring-orange-600/[0.12] rounded-3xl p-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400 mb-4">Buy on Insound</p>
            <p className="font-display text-3xl font-bold tracking-tight text-orange-400 mb-2">90%</p>
            <p className="text-sm text-zinc-300 leading-relaxed">to the artist, always. Your {formatPrice(convertPrice(10, 'GBP', currency))} = {formatPrice(convertPrice(9, 'GBP', currency))} to the artist.<br />We take 10% and absorb all processing fees out of our cut.</p>
          </div>
        </div>
      </section>

      <div className="line mx-6" />

      {/* ── £10 BREAKDOWN ────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 bg-orange-600/10 ring-1 ring-orange-600/20 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-6">
              Your {formatPrice(convertPrice(10, 'GBP', currency))}
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[0.92]">
              Where your money goes.
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl p-5 text-center ring-1 bg-orange-600/[0.08] ring-orange-600/[0.15]">
              <p className="font-display text-2xl md:text-3xl font-bold tracking-tight text-orange-500">{formatPrice(convertPrice(9, 'GBP', currency))}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 mt-1">To the artist (90%)</p>
            </div>
            <div className="rounded-2xl p-5 text-center ring-1 bg-white/[0.02] ring-white/[0.06]">
              <p className="font-display text-2xl md:text-3xl font-bold tracking-tight text-white">{formatPrice(convertPrice(1, 'GBP', currency))}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 mt-1">Insound (10%)</p>
              <p className="text-[9px] text-zinc-600 mt-0.5">incl. Stripe processing</p>
            </div>
          </div>
        </div>
      </section>

      <div className="line mx-6" />

      {/* ── WHY HERE ─────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 bg-orange-600/10 ring-1 ring-orange-600/20 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-6">
              Why here
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[0.92]">
              Your money, your choice.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {WHY_HERE.map(item => (
              <div key={item.title} className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-2xl p-6">
                <p className="font-display font-bold text-base mb-1">{item.title}</p>
                <p className="text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="line mx-6" />

      {/* ── CLOSING LINE ─────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-display text-2xl md:text-3xl font-bold tracking-tight leading-snug">
            Discover on Spotify. But when you find something you love - <span className="text-orange-500">buy it here.</span>
          </p>
          <p className="text-zinc-400 text-base mt-4 leading-relaxed">
            The artist will feel the difference. We promise.
          </p>
        </div>
      </section>

      <div className="line mx-6" />

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 bg-orange-600/10 ring-1 ring-orange-600/20 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-10">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 pulse-dot" />
            Now live
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.04em] leading-[0.9] mb-6">
            Browse music.
          </h2>
          <p className="text-zinc-400 text-sm max-w-sm mx-auto mb-10 leading-relaxed">
            Discover independent artists, support them directly, and build your collection.
          </p>

          <a href="/explore"
            className="inline-block bg-orange-600 hover:bg-orange-500 text-black font-bold text-sm px-7 py-4 rounded-2xl transition-colors shadow-xl shadow-orange-600/25 whitespace-nowrap">
            Explore music →
          </a>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-900/80 py-16">
        <div className="max-w-4xl mx-auto px-6 flex flex-col items-center gap-6">
          <Image src="/insound_logo_orange.svg" alt="insound." width={80} height={32} className="h-8 w-auto" />
          <div className="flex flex-wrap justify-center gap-6 text-[11px] font-bold uppercase tracking-[0.2em] t-faint">
            <Link href="/for-artists" className="hover:text-orange-500 transition-colors">Artists</Link>
            <Link href="/for-fans" className="text-orange-500">Fans</Link>
            <Link href="/for-press" className="hover:text-orange-500 transition-colors">Press</Link>
            <Link href="/privacy" className="hover:text-orange-500 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-orange-500 transition-colors">Terms</Link>
            <Link href="/ai-policy" className="hover:text-orange-500 transition-colors">AI Policy</Link>
          </div>
          <p className="text-zinc-700 text-[11px] font-medium">&copy; 2026 Insound</p>
        </div>
      </footer>
    </main>
  )
}
