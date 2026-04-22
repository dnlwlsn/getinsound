'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useCurrency } from '../providers/CurrencyProvider'

/* ── Data ─────────────────────────────────────────────────────── */

const STATS = [
  { value: '10%', label: 'Our cut, that\u2019s it' },
  { value: '£0', label: 'Monthly fee' },
  { value: '£2', label: 'Minimum sale price' },
  { value: '100%', label: 'You own your masters' },
]

const STEPS = [
  { num: '01', title: 'Upload', desc: 'WAV, FLAC, AIFF or MP3. Page live instantly.' },
  { num: '02', title: 'Set your price', desc: '£2 minimum, no ceiling. Pay what you want available on every release.' },
  { num: '03', title: 'Get paid', desc: 'We only take 10%. Stripe processing (1.5% + 20p) shown at checkout. Everything else is yours, direct to your Stripe account.' },
  { num: '04', title: 'Own everything', desc: 'Your masters, forever.' },
]

const WHY_NOW = [
  'Bandcamp sold twice. Artist trust is broken.',
  'Spotify: ~£0.003 per stream. 333,000+ to earn £1,000.',
  'Insound bootstrapped. No investors. No pressure to raise cut.',
  'We only make money when you make money — 10%, nothing else.',
  'Stripe: 1.5% + 20p. Shown at checkout. No markup.',
]

const COMPETITOR_CARDS = [
  {
    number: '01',
    name: 'Streaming vs Insound',
    subtitle: 'How streaming stacks up',
    rows: [
      { label: 'Artist cut', them: '~0.003 per stream', us: '~87% after all fees' },
      { label: 'To earn 1,000', them: '333,000+ streams', us: '~112 sales at 10' },
      { label: 'Pricing control', them: 'None', us: 'You set the price' },
      { label: 'Fan relationship', them: 'Anonymous', us: 'Direct — you own it' },
      { label: "Who it's for", them: 'Everyone', us: 'Independent artists only' },
    ],
  },
  {
    number: '02',
    name: 'Bandcamp vs Insound',
    subtitle: 'The platform we learned from',
    rows: [
      { label: 'Artist cut', them: '~80% after all fees', us: '~87% after all fees' },
      { label: 'Revenue threshold', them: 'Higher rate after $5k', us: 'None — same rate from sale one' },
      { label: 'Platform future', them: 'Sold twice since 2022', us: 'Independent, no investors' },
      { label: "Who it's for", them: 'Everyone including labels', us: 'Independent & unsigned only' },
      { label: 'Holds your money', them: 'Yes', us: 'Never' },
    ],
  },
  {
    number: '03',
    name: 'Competitors vs Insound',
    subtitle: 'Other direct-to-fan platforms',
    rows: [
      { label: 'Cost to join', them: 'Up to $10/yr upfront', us: 'Free, forever' },
      { label: 'Holds your money', them: 'Yes — PayPal or batched', us: 'Never — straight to Stripe' },
      { label: 'Payment method', them: 'PayPal or delayed transfer', us: 'Stripe — instant, direct' },
      { label: 'Platform stability', them: 'Donation-funded or beta', us: 'Independently sustainable' },
      { label: "Who it's for", them: 'Broad or niche scenes', us: 'Independent artists only' },
    ],
  },
]

const FAQ = [
  { q: 'Is the 10% rate permanent?', a: "Yes. Our 10% is not a launch promotion or an introductory offer — it's the whole business model. Stripe separately charges their standard processing fee, shown transparently at checkout. Both fees are permanent." },
  { q: 'Does Insound hold my money?', a: 'Never. We use Stripe Connect direct charges — when a fan buys your music, the payment goes directly to your Stripe account. We take our 10% as an application fee at the point of sale. Your money is yours from the moment the transaction completes.' },
  { q: 'What formats do you accept?', a: 'WAV, FLAC, AIFF, and MP3. We recommend lossless where possible — your fans deserve the best quality.' },
  { q: 'Are there any hidden fees?', a: "No. We take a flat 10%. Stripe charges their standard processing fee. Both shown at checkout — nothing hidden." },
  { q: 'Do I keep my masters?', a: 'Always. Uploading to Insound gives us nothing except permission to host and sell your music on your behalf. You own everything, forever.' },
  { q: 'Is there a subscription fee?', a: 'No. It costs nothing to sign up, nothing to upload, and nothing per month. We only make money when you make a sale.' },
  { q: 'What happens if I want to leave?', a: 'You can remove your music at any time. Your Stripe earnings are already in your account — we never hold them. No lock-in, no penalty.' },
  { q: 'Can I set pay what you want pricing?', a: 'Yes. Every release has a minimum price and fans can pay more if they choose. Many artists find fans voluntarily pay well above the minimum.' },
  { q: 'How do download codes work?', a: 'Coming soon. You\'ll be able to generate unique download codes for gig merch bundles, press, or promotions. Codes will be single-use and trackable from your dashboard.' },
  { q: 'Can I do pre-orders?', a: 'Coming soon. Pre-orders are on our roadmap — fans will be able to pay upfront and get the release on launch day.' },
]

/* ── Component ────────────────────────────────────────────────── */

export function ForArtistsClient() {
  const { currency, formatPrice, convertPrice } = useCurrency()

  const STATS = [
    { value: '10%', label: 'Our cut, that’s it' },
    { value: formatPrice(0), label: 'Monthly fee' },
    { value: formatPrice(convertPrice(2, 'GBP', currency)), label: 'Minimum sale price' },
    { value: '100%', label: 'You own your masters' },
  ]

  const STEPS_DYNAMIC = [
    { num: '01', title: 'Upload', desc: 'WAV, FLAC, AIFF or MP3. Page live instantly.' },
    { num: '02', title: 'Set your price', desc: `${formatPrice(convertPrice(2, 'GBP', currency))} minimum, no ceiling. Pay what you want available on every release.` },
    { num: '03', title: 'Get paid', desc: `We only take 10%. Stripe’s standard processing fee shown at checkout. Everything else is yours, direct to your Stripe account.` },
    { num: '04', title: 'Own everything', desc: 'Your masters, forever.' },
  ]

  const WHY_NOW_DYNAMIC = [
    'Bandcamp sold twice. Artist trust is broken.',
    `Spotify: ~${formatPrice(convertPrice(0.003, 'GBP', currency))} per stream. 333,000+ to earn ${formatPrice(convertPrice(1000, 'GBP', currency))}.`,
    'Insound bootstrapped. No investors. No pressure to raise cut.',
    'We only make money when you make money — 10%, nothing else.',
    'Stripe’s standard processing fee. Shown at checkout. No markup.',
  ]

  return (
    <main className="bg-[#0A0A0A] text-white min-h-screen">

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
            For Artists
          </span>
          <h1 className="font-display font-bold tracking-[-0.04em] leading-[0.88] mb-6"
            style={{ fontSize: 'clamp(2.8rem, 5.5vw, 5rem)' }}>
            Your music. Your money.<br /><span className="text-orange-500">Permanently.</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-lg mx-auto leading-relaxed">
            For independent and unsigned artists only.
          </p>
        </div>
      </section>

      {/* ── STAT CARDS ───────────────────────────────────────────── */}
      <section className="pb-24 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <p className="font-display text-4xl md:text-5xl font-bold tracking-tight text-white">{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 mt-2">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="line mx-6" />

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 bg-orange-600/10 ring-1 ring-orange-600/20 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-6">
              How it works
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[0.92]">
              Four steps. That&apos;s it.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {STEPS_DYNAMIC.map(s => (
              <div key={s.num} className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl p-8">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500 mb-3">{s.num}</p>
                <p className="font-display text-xl font-bold mb-2">{s.title}</p>
                <p className="text-sm text-zinc-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="line mx-6" />

      {/* ── WHY NOW ──────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 bg-orange-600/10 ring-1 ring-orange-600/20 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-6">
              Why now
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[0.92]">
              The industry isn&apos;t changing.<br />So we built something new.
            </h2>
          </div>
          <div className="space-y-4">
            {WHY_NOW_DYNAMIC.map((line, i) => (
              <div key={i} className="flex items-start gap-4 bg-white/[0.02] ring-1 ring-white/[0.06] rounded-2xl p-5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2 shrink-0" />
                <p className="text-sm text-zinc-300 leading-relaxed">{line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="line mx-6" />

      {/* ── NO ASTERISKS ─────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-orange-600/[0.06] ring-1 ring-orange-600/[0.12] rounded-3xl p-10 md:p-14">
            <p className="font-display text-2xl md:text-3xl font-bold tracking-tight leading-snug">
              &ldquo;10% is permanent. Not a launch offer.<br />Every fee, transparent.&rdquo;
            </p>
          </div>
        </div>
      </section>

      <div className="line mx-6" />

      {/* ── COMPETITOR COMPARISON ─────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 bg-orange-600/10 ring-1 ring-orange-600/20 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-6">
              The difference
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[0.92]">
              See how we compare.
            </h2>
          </div>

          <div className="compare-cards">
            {COMPETITOR_CARDS.map(card => (
              <article key={card.number} className="compare-card border rounded-3xl overflow-hidden">
                <div className="px-6 pt-6 pb-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] t-faint">{card.number}</p>
                  <p className="font-display text-xl font-bold text-white mt-1">{card.name}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{card.subtitle}</p>
                </div>
                <div className="grid grid-cols-2 mt-4">
                  <div className="col-bad p-5 border-t border-r border-white/[0.04]">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-red-400/70 mb-4">Them</p>
                    <div className="space-y-4">
                      {card.rows.map(r => (
                        <div key={r.label}>
                          <p className="text-[10px] text-zinc-600 mb-1">{r.label}</p>
                          <p className="font-bold text-red-400 text-xs leading-snug">{r.them}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="col-good p-5 border-t border-white/[0.04]">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-orange-400 mb-4">insound.</p>
                    <div className="space-y-4">
                      {card.rows.map(r => (
                        <div key={r.label}>
                          <p className="text-[10px] text-zinc-600 mb-1">{r.label}</p>
                          <p className="font-bold text-orange-400 text-xs leading-snug">{r.us}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* After cards */}
          <div className="text-center mt-16 space-y-3">
            <p className="font-display text-2xl md:text-3xl font-bold tracking-tight">
              No upfront cost. No monthly fee. No risk.
            </p>
            <p className="text-zinc-400 text-sm">
              Free to join. Free to upload. You only pay when a fan pays you.
            </p>
          </div>
        </div>
      </section>

      <div className="line mx-6" />

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 bg-orange-600/10 ring-1 ring-orange-600/20 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-6">
              FAQ
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[0.92]">
              Questions artists ask.
            </h2>
          </div>
          <div>
            {FAQ.map(({ q, a }) => (
              <FaqAccordion key={q} question={q} answer={a} />
            ))}
          </div>
        </div>
      </section>

      <div className="line mx-6" />

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 bg-orange-600/10 ring-1 ring-orange-600/20 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-10">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 pulse-dot" />
            Now open
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.04em] leading-[0.9] mb-6">
            Your music.<br />Your money.
          </h2>
          <p className="text-zinc-400 text-sm max-w-sm mx-auto mb-10 leading-relaxed">
            Sign up and start selling. We only take 10%. Every fee shown upfront.
          </p>
          <Link href="/signup?intent=artist"
            className="inline-block bg-orange-600 hover:bg-orange-500 text-black font-bold text-sm px-8 py-4 rounded-2xl transition-colors shadow-xl shadow-orange-600/25">
            Start selling your music →
          </Link>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-900/80 py-16">
        <div className="max-w-4xl mx-auto px-6 flex flex-col items-center gap-6">
          <Image src="/insound_logo_orange.svg" alt="insound." width={80} height={32} className="h-8 w-auto" />
          <div className="flex flex-wrap justify-center gap-6 text-[11px] font-bold uppercase tracking-[0.2em] t-faint">
            <Link href="/for-artists" className="text-orange-500">Artists</Link>
            <Link href="/for-fans" className="hover:text-orange-500 transition-colors">Fans</Link>
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

/* ── Inline FAQ accordion ─────────────────────────────────────── */
function FaqAccordion({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  function toggle() {
    if (!bodyRef.current) return
    if (!open) {
      setHeight(bodyRef.current.scrollHeight)
    } else {
      setHeight(bodyRef.current.scrollHeight)
      requestAnimationFrame(() => setHeight(0))
    }
    setOpen(!open)
  }

  return (
    <div className="border-b border-white/[0.06]">
      <button onClick={toggle} className="flex w-full items-center justify-between py-5 text-left">
        <span className="font-display font-bold text-base text-white">{question}</span>
        <span className="text-zinc-500 text-lg transition-transform duration-200"
          style={{ transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
      </button>
      <div ref={bodyRef}
        className="overflow-hidden transition-[height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ height }}>
        <p className="t-muted text-sm leading-relaxed pb-5 pr-8">{answer}</p>
      </div>
    </div>
  )
}
