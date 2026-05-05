'use client'

import Link from 'next/link'

const STEPS = [
  {
    num: '01',
    title: 'Download your music from Bandcamp',
    instructions: [
      'Log in to your Bandcamp artist account.',
      'Go to your artist page and click each release.',
      'Under each release, click "Edit" then "Download" to get your original WAV/FLAC files.',
      'Save them in a folder per release.',
    ],
    tip: 'Bandcamp stores whatever you originally uploaded. If you uploaded WAV or FLAC, you\'ll get those back.',
  },
  {
    num: '02',
    title: 'Export your fan list',
    instructions: [
      'In your Bandcamp dashboard, go to "Fans" or "Supporters".',
      'Click "Export data" (top right) to download a CSV of everyone who bought from you.',
      'This gives you emails, purchase dates, and amounts — your direct relationship with your fans.',
    ],
    tip: 'This is yours. Save it somewhere safe regardless of what platform you use.',
  },
  {
    num: '03',
    title: 'Create your Insound account',
    instructions: [
      'Sign up at insound and register as an artist.',
      'Choose your artist slug (your URL).',
      'Connect your Stripe account — this is where your money goes directly.',
    ],
    tip: 'Stripe setup takes 2 minutes. You\'ll need a bank account and basic identity info.',
  },
  {
    num: '04',
    title: 'Upload your releases',
    instructions: [
      'From your dashboard, click "New Release".',
      'Set your title, price, and upload your tracks (WAV, FLAC, AIFF, or MP3).',
      'Upload your cover art, or let Insound generate unique gradient artwork.',
      'Add sound tags so fans can discover your music.',
      'Hit publish — your release is live instantly.',
    ],
    tip: 'You can upload your entire catalogue in one sitting. Each release takes about 2 minutes.',
  },
  {
    num: '05',
    title: 'Tell your fans',
    instructions: [
      'Use the fan list you exported to email your supporters.',
      'Let them know your music is now on Insound and share your artist URL.',
      'Post your new Insound link on socials, your website, and your link-in-bio.',
    ],
    tip: 'Your fans already paid once — they\'re the most likely people to support you again on a platform that gives you more.',
  },
]

const COMPARISON = [
  { label: 'Your cut', bandcamp: '~80% after all fees', insound: '90% — we absorb processing fees' },
  { label: 'Monthly fee', bandcamp: 'Free', insound: 'Free' },
  { label: 'Payment', bandcamp: 'Bandcamp holds funds, pays on schedule', insound: 'Direct to your Stripe — instant' },
  { label: 'Ownership', bandcamp: 'Sold twice since 2022', insound: 'Independent, no investors' },
  { label: 'Who can join', bandcamp: 'Anyone, including labels', insound: 'Independent artists only' },
  { label: 'Lock-in', bandcamp: 'Your data is exportable', insound: 'Leave any time, money already yours' },
]

const FAQ = [
  { q: 'Do I have to delete my Bandcamp?', a: 'No. Many artists keep both during transition. There\'s no exclusivity requirement on Insound.' },
  { q: 'Can I set the same prices?', a: 'Yes. You set your own price with a minimum of £3. Pay-what-you-want is available on every release, just like Bandcamp.' },
  { q: 'What about my existing Bandcamp supporters?', a: 'Export your fan list from Bandcamp and let them know you\'re on Insound. They already support you — they\'ll follow.' },
  { q: 'Will my fans need to re-purchase?', a: 'Yes, purchases don\'t transfer between platforms. But your supporters know you\'re worth it — especially when more goes to you.' },
  { q: 'What if I have merch on Bandcamp?', a: 'Insound supports merch listings. Upload your items with variants, set postage costs, and manage orders from your dashboard.' },
  { q: 'Can I do download codes like Bandcamp?', a: 'Yes. Generate unique download codes for gig bundles, press, or promos — single-use and trackable from your dashboard.' },
]

export function MoveFromBandcampClient() {
  return (
    <main className="bg-zinc-950 text-white min-h-screen">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="pt-16 pb-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 bg-orange-600/10 ring-1 ring-orange-600/20 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-10">
            Migration Guide
          </span>
          <h1 className="font-display font-bold tracking-[-0.04em] leading-[0.88] mb-6"
            style={{ fontSize: 'clamp(2.4rem, 5vw, 4.2rem)' }}>
            Move from Bandcamp<br />to <span className="text-orange-500">Insound</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto leading-relaxed">
            Five steps. About 30 minutes for a full catalogue. Keep 90% of every sale from day one.
          </p>
        </div>
      </section>

      {/* ── STEPS ────────────────────────────────────────────────── */}
      <section className="pb-24 px-6">
        <div className="max-w-3xl mx-auto space-y-8">
          {STEPS.map(step => (
            <div key={step.num} className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl p-8">
              <div className="flex items-baseline gap-4 mb-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500">{step.num}</span>
                <h2 className="font-display text-xl font-bold">{step.title}</h2>
              </div>
              <ol className="space-y-2 mb-4">
                {step.instructions.map((inst, i) => (
                  <li key={i} className="flex gap-3 text-sm text-zinc-300 leading-relaxed">
                    <span className="text-zinc-600 font-bold shrink-0">{i + 1}.</span>
                    {inst}
                  </li>
                ))}
              </ol>
              <div className="bg-orange-600/5 ring-1 ring-orange-600/10 rounded-xl px-4 py-3">
                <p className="text-xs text-orange-400/80"><span className="font-bold">Tip:</span> {step.tip}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="line mx-6" />

      {/* ── COMPARISON TABLE ──────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-[-0.03em]">
              What changes
            </h2>
            <p className="text-zinc-500 text-sm mt-3">Side-by-side, so you know what you&apos;re getting.</p>
          </div>
          <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl overflow-hidden">
            <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-white/[0.06]">
              <div />
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Bandcamp</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-orange-500">Insound</p>
            </div>
            {COMPARISON.map(row => (
              <div key={row.label} className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-white/[0.03] last:border-0">
                <p className="text-sm font-bold text-zinc-300">{row.label}</p>
                <p className="text-sm text-zinc-500">{row.bandcamp}</p>
                <p className="text-sm text-white">{row.insound}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="line mx-6" />

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-[-0.03em] text-center mb-12">
            Common questions
          </h2>
          <div className="space-y-6">
            {FAQ.map(item => (
              <div key={item.q} className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-2xl px-6 py-5">
                <p className="font-bold text-sm mb-2">{item.q}</p>
                <p className="text-sm text-zinc-400 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="line mx-6" />

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-display text-3xl font-bold tracking-[-0.03em] mb-4">
            Ready to move?
          </h2>
          <p className="text-zinc-400 text-sm mb-8">
            Takes about 30 minutes for a full catalogue. Free to join, no lock-in, money goes straight to you.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-orange-600 hover:bg-orange-500 text-black font-bold text-sm px-8 py-4 rounded-xl transition-colors"
          >
            Create your artist account &rarr;
          </Link>
        </div>
      </section>

      <div className="h-24" />
    </main>
  )
}
