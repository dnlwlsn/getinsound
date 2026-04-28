'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCurrency } from '../providers/CurrencyProvider'

const KEY_FACTS = [
  { label: 'Founded', value: '2026, UK' },
  { label: 'Model', value: 'Bootstrapped - no investors' },
  { label: 'Platform fee', value: '10% flat - artists keep 90%. We absorb all Stripe processing fees' },
  { label: 'Monthly fee', value: 'None' },
  { label: 'Payout threshold', value: 'None' },
  { label: 'Who can join', value: 'Independent & unsigned artists only' },
  { label: 'Minimum sale', value: '£3.00' },
  { label: 'Payment processing', value: 'Stripe processing fees absorbed by Insound out of our 10% - no additional cost to artists' },
  { label: 'Masters', value: 'Artists retain 100%' },
  { label: 'Future features', value: 'Merch, pre-orders, download codes, collectives' },
]

const MARKET_STATS = [
  { value: '$14.3B', label: 'Independent music market, 2024' },
  { value: '46.7%', label: 'Global market share, independents' },
  { value: '16.1%', label: 'Revenue growth, 2024' },
  { value: '40M+', label: 'Active independent creators' },
]

export function ForPressClient() {
  const { currency, formatPrice, convertPrice } = useCurrency()

  const KEY_FACTS_DYNAMIC = KEY_FACTS.map(f =>
    f.label === 'Minimum sale'
      ? { ...f, value: formatPrice(convertPrice(3, 'GBP', currency)) }
      : f
  )

  return (
    <main className="bg-zinc-950 text-white min-h-screen">

      {/* ── NAV ──────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div id="navInner" className="mx-4 mt-4 px-5 py-3 rounded-2xl ring-1 ring-white/[0.05] flex items-center justify-between">
          <Link href="/" className="font-display text-lg font-bold">insound<span className="text-orange-500">.</span></Link>
          <Link href="/" className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">← Back</Link>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="pt-40 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 bg-orange-600/10 ring-1 ring-orange-600/20 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-10">
            Press
          </span>
          <h1 className="font-display font-bold tracking-[-0.04em] leading-[0.88] mb-6"
            style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)' }}>
            The platform built on what<br />Bandcamp <span className="text-orange-500">forgot.</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto leading-relaxed">
            Insound is a direct-to-fan music platform for independent and unsigned artists - launching in 2026.
          </p>
        </div>
      </section>

      {/* ── KEY FACTS ────────────────────────────────────────────── */}
      <section className="pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 bg-orange-600/10 ring-1 ring-orange-600/20 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-6">
              Key facts
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[0.92]">
              At a glance.
            </h2>
          </div>
          <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl overflow-hidden">
            {KEY_FACTS_DYNAMIC.map((fact, i) => (
              <div key={fact.label}
                className={`flex items-start sm:items-center justify-between gap-4 px-6 py-4 ${i < KEY_FACTS.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500 shrink-0 w-40">{fact.label}</p>
                <p className="text-sm text-zinc-300 text-right sm:text-left">{fact.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="line mx-6" />

      {/* ── THE STORY ────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 bg-orange-600/10 ring-1 ring-orange-600/20 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-6">
              The story
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[0.92]">
              Why Insound exists.
            </h2>
          </div>
          <div className="space-y-6 text-zinc-300 text-base leading-relaxed">
            <p>
              Bandcamp was sold to Epic Games in 2022. Sold again to Songtradr in 2023, who laid off most of the team within weeks. By Q1 2026, active Bandcamp stores had declined 50% quarter-over-quarter.
            </p>
            <p>
              Insound was built because the model that Bandcamp proved - direct-to-fan, artist-first, pay-what-you-want - deserved a platform that wouldn&apos;t get sold out from under the artists who depend on it.
            </p>
            <p>
              We&apos;re bootstrapped. No investors. No board. No pressure to raise our cut or change the deal. We take 10% and absorb all Stripe processing fees out of that cut. Artists keep exactly 90% - permanently.
            </p>
            <p>
              We only allow independent and unsigned artists. No labels. No aggregators. If you&apos;re signed to a label, Insound isn&apos;t for you - and we think that clarity matters.
            </p>
          </div>
        </div>
      </section>

      <div className="line mx-6" />

      {/* ── MARKET STATS ─────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 bg-orange-600/10 ring-1 ring-orange-600/20 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-6">
              The market
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[0.92]">
              Independent music is growing.
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {MARKET_STATS.map(s => (
              <div key={s.label} className="text-center">
                <p className="font-display text-3xl md:text-4xl font-bold tracking-tight text-orange-500">{s.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 mt-2">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="line mx-6" />

      {/* ── PRESS ASSETS ─────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 bg-orange-600/10 ring-1 ring-orange-600/20 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-6">
              Assets
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[0.92]">
              Press materials.
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <a href="/press/insound-press-deck.pdf" download="insound-press-deck.pdf"
              className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-2xl p-6 text-center hover:ring-white/[0.15] transition-all group">
              <div className="w-10 h-10 mx-auto mb-4 rounded-xl bg-orange-600/10 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F56D00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <p className="font-display font-bold text-sm mb-1 group-hover:text-orange-400 transition-colors">Press Deck</p>
              <p className="text-[10px] text-zinc-500">PDF download</p>
            </a>
            <a href="/press/insound-logo.zip" download="insound-logo.zip"
              className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-2xl p-6 text-center hover:ring-white/[0.15] transition-all group">
              <div className="w-10 h-10 mx-auto mb-4 rounded-xl bg-orange-600/10 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F56D00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <p className="font-display font-bold text-sm mb-1 group-hover:text-orange-400 transition-colors">Logo Pack</p>
              <p className="text-[10px] text-zinc-500">Light & dark, waveform (no dot)</p>
            </a>
            <a href="mailto:press@getinsound.com"
              className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-2xl p-6 text-center hover:ring-white/[0.15] transition-all group">
              <div className="w-10 h-10 mx-auto mb-4 rounded-xl bg-orange-600/10 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F56D00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <p className="font-display font-bold text-sm mb-1 group-hover:text-orange-400 transition-colors">Press Contact</p>
              <p className="text-[10px] text-zinc-500">press@getinsound.com</p>
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-900/80 py-16">
        <div className="max-w-4xl mx-auto px-6 flex flex-col items-center gap-6">
          <Image src="/insound_logo_orange.svg" alt="insound." width={80} height={32} className="h-8 w-auto" />
          <div className="flex flex-wrap justify-center gap-6 text-[11px] font-bold uppercase tracking-[0.2em] t-faint">
            <Link href="/for-artists" className="hover:text-orange-500 transition-colors">Artists</Link>
            <Link href="/for-fans" className="hover:text-orange-500 transition-colors">Fans</Link>
            <Link href="/for-press" className="text-orange-500">Press</Link>
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
