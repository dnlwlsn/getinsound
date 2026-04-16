export const metadata = {
  title: 'insound. | Music that pays artists.',
  description: 'Upload your music. Keep 90% of every sale. No monthly fee. No labels.',
}

export default function Home() {
  return (
    <main className="min-h-screen">

      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-5 px-4" style={{ pointerEvents: 'none' }}>
        <div id="navInner" className="flex items-center justify-between w-full max-w-4xl rounded-full px-5 py-3 ring-1 ring-white/[0.06] shadow-[0_8px_40px_rgba(0,0,0,0.5)]" style={{ pointerEvents: 'auto' }}>
          <span className="font-display text-lg font-bold text-orange-500 tracking-tight">insound<span className="text-white/25 hero-dot">.</span></span>
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button id="themeToggle" aria-label="Toggle light/dark mode"
              className="w-9 h-9 rounded-full flex items-center justify-center ring-1 ring-white/[0.08] hover:ring-white/20 text-zinc-400 hover:text-white">
              {/* Sun (shown in dark mode) */}
              <svg id="iconSun" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            </button>
            <a href="#top" className="bg-orange-600 hover:bg-orange-500 text-black text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-full transition-colors shadow-lg shadow-orange-600/20">
              Join the waitlist
            </a>
          </div>
        </div>
      </nav>

      <header id="top" className="relative min-h-screen flex items-center justify-center px-6 pb-20 overflow-hidden" style={{ paddingTop: '8rem' }}>
        {/* Radial glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full" style={{ background: 'radial-gradient(ellipse,rgba(234,88,12,0.1) 0%,transparent 70%)' }}></div>
        </div>

        {/* Hero text */}
        <div className="relative z-10 mx-auto text-center" style={{ maxWidth: '64rem' }}>
          <div className="inline-flex items-center gap-2 bg-orange-600/10 ring-1 ring-orange-600/20 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-10">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 pulse-dot"></span>
            Waitlist open
          </div>

          <h1 className="font-display font-bold mb-8" style={{ fontSize: 'clamp(3.5rem,6vw,5.5rem)', letterSpacing: '-0.04em', lineHeight: '0.88' }}>
            Music that<br /><span className="text-orange-500">pays artists.</span>
          </h1>

          <p className="text-zinc-400 text-lg md:text-xl leading-relaxed max-w-xl mx-auto mb-5 font-medium">
            Upload your music. Keep <strong className="text-white font-bold">90%</strong> of every sale. No monthly fee. No labels.
          </p>
          
          <div id="signup" className="max-w-md mx-auto" style={{ scrollMarginTop: '6rem' }}>
            <div id="heroForm" className="flex flex-col sm:flex-row gap-3">
              <input type="email" id="heroEmail" placeholder="your@email.com" autoComplete="email"
                className="flex-1 bg-zinc-900 ring-1 ring-white/[0.08] border border-transparent rounded-2xl px-5 py-4 text-sm text-white placeholder-zinc-600 transition-all" />
              <button className="bg-orange-600 hover:bg-orange-500 text-black font-bold text-sm px-7 py-4 rounded-2xl transition-colors shadow-xl shadow-orange-600/25 whitespace-nowrap">
                Join the waitlist →
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── STATS ─────────────────────────────────────────────────────── */}
      <section className="relative py-10 md:py-16">
        <div className="max-w-4xl mx-auto px-6 md:px-14 py-8 md:py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
            <div>
              <p className="font-display text-4xl font-bold text-white tracking-tight">90%</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mt-2">Revenue to you</p>
            </div>
            <div>
              <p className="font-display text-4xl font-bold text-orange-500 tracking-tight">£0</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mt-2">Monthly fee, ever</p>
            </div>
          </div>
        </div>
      </section>

      {/* Additional sections truncated for brevity but follow the same pattern */}
    </main>
  );
}