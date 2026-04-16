'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

/* ── Supabase config ─────────────────────────────────────────── */
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://rvsfriqjobwuzzfdiyxg.supabase.co'
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_m2T7SpX_nYsK9i9CC3aDDw_SFeOtEUg'
const TOTAL_SPOTS = 1000

/* ── Typewriter items ────────────────────────────────────────── */
const COST_ITEMS = [
  'Recording studio time',
  'Mixing & mastering',
  'Equipment',
  'Music video production',
  'PR and playlist pitching',
  'Session musicians',
  'PRS/MCPS membership fees',
  'Social media advertising',
  'Publishing fees',
  'Pay to play',
]

/* ── Phone mockup tracks ─────────────────────────────────────── */
const TRACKS = [
  { name: 'Midnight Drive', type: 'Album', year: '2026', price: 8,  color1: '#ea580c', color2: '#431407', glow: '234,88,12' },
  { name: 'Ghost Signal',   type: 'Single',year: '2026', price: 5,  color1: '#1d4ed8', color2: '#0f172a', glow: '29,78,216' },
  { name: 'Neon Requiem',   type: 'EP',    year: '2025', price: 10, color1: '#7c3aed', color2: '#1a0533', glow: '124,58,237' },
  { name: 'Tender Light',   type: 'Album', year: '2025', price: 9,  color1: '#059669', color2: '#022c22', glow: '5,150,105' },
  { name: 'Fading Out',     type: 'Single',year: '2025', price: 4,  color1: '#dc2626', color2: '#1c0505', glow: '220,38,38' },
  { name: 'Golden Hour',    type: 'EP',    year: '2025', price: 7,  color1: '#d97706', color2: '#1a0f00', glow: '217,119,6' },
]

/* ── Email validation ────────────────────────────────────────── */
const isValidEmail = (e: string) => !!e && /\S+@\S+\.\S+/.test(e)

export default function HomeClient() {
  /* Theme */
  const [isLight, setIsLight]       = useState(false)

  /* Waitlist */
  const [wPhase, setWPhase]         = useState<'form' | 'success' | 'overflow'>('form')
  const [ovPhase, setOvPhase]       = useState<'form' | 'success'>('form')
  const [spacesLeft, setSpacesLeft] = useState(1000)

  /* Form inputs */
  const [heroEmail, setHeroEmail]                   = useState('')
  const [bottomEmail, setBottomEmail]               = useState('')
  const [heroOvEmail, setHeroOvEmail]               = useState('')
  const [bottomOvEmail, setBottomOvEmail]           = useState('')
  const [heroInvalid, setHeroInvalid]               = useState(false)
  const [bottomInvalid, setBottomInvalid]           = useState(false)
  const [heroOvInvalid, setHeroOvInvalid]           = useState(false)
  const [bottomOvInvalid, setBottomOvInvalid]       = useState(false)
  const [heroSending, setHeroSending]               = useState(false)
  const [bottomSending, setBottomSending]           = useState(false)
  const [heroOvSending, setHeroOvSending]           = useState(false)
  const [bottomOvSending, setBottomOvSending]       = useState(false)

  /* Calculator */
  const [calcPrice, setCalcPrice]   = useState(10)
  const [currSym, setCurrSym]       = useState('£')

  /* Typewriter */
  const [twText, setTwText]         = useState('')
  const [twFading, setTwFading]     = useState(false)
  const twRunning                   = useRef(false)
  const twTimer                     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const costCardRef                 = useRef<HTMLDivElement>(null)

  /* Phone mockup */
  const [phoneTime, setPhoneTime]   = useState('9:41')
  const [activeTrack, setActiveTrack] = useState(TRACKS[0].name)
  const [banner, setBanner]         = useState({ color1: TRACKS[0].color1, color2: TRACKS[0].color2, glow: TRACKS[0].glow })
  const [basket, setBasket]         = useState<string[]>([])

  /* Hero email ref for focus-pop */
  const heroEmailRef = useRef<HTMLInputElement>(null)

  /* ── Theme init ──────────────────────────────────────────────── */
  useEffect(() => {
    setIsLight(document.documentElement.getAttribute('data-theme') === 'light')
  }, [])

  function toggleTheme() {
    const next = !isLight
    setIsLight(next)
    document.documentElement.setAttribute('data-theme', next ? 'light' : 'dark')
    localStorage.setItem('insound_theme', next ? 'light' : 'dark')
  }

  /* ── Scroll reveals ──────────────────────────────────────────── */
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target) } }),
      { threshold: 0.12 }
    )
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  /* ── Already signed up ───────────────────────────────────────── */
  useEffect(() => {
    if (localStorage.getItem('insound_interested')) setWPhase('success')
  }, [])

  /* ── Spaces left ─────────────────────────────────────────────── */
  function refreshSpaces() {
    fetch(`${SB_URL}/rest/v1/rpc/get_waitlist_count`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      body: '{}',
    })
      .then(r => r.json())
      .then(count => {
        if (typeof count === 'number') {
          const left = Math.max(0, TOTAL_SPOTS - count)
          setSpacesLeft(left)
          if (left <= 0) setWPhase('overflow')
        }
      })
      .catch(() => {})
  }
  useEffect(() => { refreshSpaces() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Waitlist submit helpers ─────────────────────────────────── */
  function postWaitlist(
    email: string,
    setSending: (v: boolean) => void,
    onSuccess: () => void,
  ) {
    setSending(true)
    fetch(`${SB_URL}/rest/v1/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Prefer: 'return=minimal' },
      body: JSON.stringify({ email }),
    })
      .then(r => {
        if (r.ok || r.status === 409) {
          localStorage.setItem('insound_interested', '1')
          refreshSpaces()
          onSuccess()
        } else { setSending(false) }
      })
      .catch(() => { setSending(false) })
  }

  function postOverflow(
    email: string,
    setSending: (v: boolean) => void,
    onSuccess: () => void,
  ) {
    setSending(true)
    fetch(`${SB_URL}/rest/v1/waitlist_overflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Prefer: 'return=minimal' },
      body: JSON.stringify({ email }),
    })
      .then(r => {
        if (r.ok || r.status === 409) { onSuccess() } else { setSending(false) }
      })
      .catch(() => { setSending(false) })
  }

  function submitHero() {
    if (!isValidEmail(heroEmail)) { setHeroInvalid(true); return }
    setHeroInvalid(false)
    postWaitlist(heroEmail, setHeroSending, () => setWPhase('success'))
  }

  function submitBottom() {
    if (!isValidEmail(bottomEmail)) { setBottomInvalid(true); return }
    setBottomInvalid(false)
    postWaitlist(bottomEmail, setBottomSending, () => setWPhase('success'))
  }

  function submitHeroOv() {
    if (!isValidEmail(heroOvEmail)) { setHeroOvInvalid(true); return }
    setHeroOvInvalid(false)
    postOverflow(heroOvEmail, setHeroOvSending, () => setOvPhase('success'))
  }

  function submitBottomOv() {
    if (!isValidEmail(bottomOvEmail)) { setBottomOvInvalid(true); return }
    setBottomOvInvalid(false)
    postOverflow(bottomOvEmail, setBottomOvSending, () => setOvPhase('success'))
  }

  /* ── Nav CTA — scroll to top + pop email ─────────────────────── */
  function scrollAndPop(e: React.MouseEvent) {
    e.preventDefault()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => {
      const el = heroEmailRef.current
      if (!el) return
      el.classList.add('email-pop')
      el.focus()
      el.addEventListener('animationend', () => el.classList.remove('email-pop'), { once: true })
    }, 400)
  }

  /* ── Phone clock ─────────────────────────────────────────────── */
  useEffect(() => {
    function tick() {
      const n = new Date()
      setPhoneTime(`${n.getHours().toString().padStart(2, '0')}:${n.getMinutes().toString().padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 10000)
    return () => clearInterval(id)
  }, [])

  /* ── Currency detection ──────────────────────────────────────── */
  useEffect(() => {
    const map: Record<string, string> = {
      'en-US': 'USD', 'en-CA': 'CAD', 'en-AU': 'AUD', 'en-NZ': 'NZD',
      ja: 'JPY', ko: 'KRW', zh: 'CNY', hi: 'INR', 'pt-BR': 'BRL',
      sv: 'SEK', no: 'NOK', da: 'DKK', pl: 'PLN', tr: 'TRY',
      de: 'EUR', fr: 'EUR', it: 'EUR', es: 'EUR', nl: 'EUR',
      pt: 'EUR', fi: 'EUR', el: 'EUR', sk: 'EUR', sl: 'EUR',
    }
    const locale = navigator.language || 'en-GB'
    const lang = locale.split('-')[0]
    const code = map[locale] || map[lang] || 'GBP'
    let sym = '£'
    try {
      sym = (0).toLocaleString(locale, { style: 'currency', currency: code, maximumFractionDigits: 0 })
        .replace(/[\d\s.,]/g, '').trim() || '£'
    } catch {}
    setCurrSym(sym)
  }, [])

  /* ── Typewriter ──────────────────────────────────────────────── */
  useEffect(() => {
    const card = costCardRef.current
    if (!card) return

    const TYPE_MS = 55, HOLD_MS = 1400, FADE_MS = 360
    let idx = 0

    function wait(ms: number) {
      return new Promise<void>(res => { twTimer.current = setTimeout(res, ms) })
    }

    async function typeIn(str: string) {
      setTwText('')
      for (let i = 0; i < str.length; i++) {
        if (!twRunning.current) return
        setTwText(str.slice(0, i + 1))
        await wait(TYPE_MS)
      }
    }

    async function loop() {
      while (twRunning.current) {
        const word = COST_ITEMS[idx % COST_ITEMS.length]
        setTwFading(false)
        await typeIn(word)
        if (!twRunning.current) return
        await wait(HOLD_MS)
        if (!twRunning.current) return
        setTwFading(true)
        await wait(FADE_MS)
        if (!twRunning.current) return
        setTwText('')
        idx++
      }
    }

    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && !twRunning.current) {
          twRunning.current = true
          loop()
        } else if (!e.isIntersecting && twRunning.current) {
          twRunning.current = false
          if (twTimer.current) clearTimeout(twTimer.current)
        }
      })
    }, { threshold: 0.25 })

    obs.observe(card)
    return () => {
      twRunning.current = false
      if (twTimer.current) clearTimeout(twTimer.current)
      obs.disconnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Calculator derived values ───────────────────────────────── */
  const calcFill     = `${((calcPrice - 1) / 49 * 100).toFixed(1)}%`
  const calcStreams   = Math.round(calcPrice * 0.9 / 0.003)
  const calcStreamLbl = calcStreams >= 1000 ? `${Math.round(calcStreams / 1000).toLocaleString()},000+` : calcStreams.toLocaleString()
  const calcBcPer    = `${currSym}${(calcPrice * 0.8).toFixed(2)}`
  const calcInPer    = `${currSym}${(calcPrice * 0.9).toFixed(2)}`
  const calcBcSales  = `~${Math.ceil(1000 / (calcPrice * 0.8))}`
  const calcInSales  = Math.ceil(1000 / (calcPrice * 0.9))

  /* ── Device basket helpers ───────────────────────────────────── */
  function toggleBasket(name: string) {
    setBasket(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  function selectTrack(track: typeof TRACKS[0]) {
    setActiveTrack(track.name)
    setBanner({ color1: track.color1, color2: track.color2, glow: track.glow })
  }

  /* ── JSX ─────────────────────────────────────────────────────── */
  return (
    <main className="min-h-screen">

      {/* ── NAV ──────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-5 px-4" style={{ pointerEvents: 'none' }}>
        <div id="navInner" className="flex items-center justify-between w-full max-w-4xl rounded-full px-5 py-3 ring-1 ring-white/[0.06] shadow-[0_8px_40px_rgba(0,0,0,0.5)]" style={{ pointerEvents: 'auto' }}>
          <span className="font-display text-lg font-bold text-orange-500 tracking-tight">
            insound<span className="text-white/25 hero-dot">.</span>
          </span>
          <div className="flex items-center gap-3">
            <button id="themeToggle" onClick={toggleTheme} aria-label="Toggle light/dark mode"
              className="w-9 h-9 rounded-full flex items-center justify-center ring-1 ring-white/[0.08] hover:ring-white/20 text-zinc-400 hover:text-white">
              <svg className={isLight ? 'hidden' : ''} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
              <svg className={isLight ? '' : 'hidden'} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </button>
            <a href="#top" onClick={scrollAndPop}
              className="bg-orange-600 hover:bg-orange-500 text-black text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-full transition-colors shadow-lg shadow-orange-600/20">
              Join the waitlist
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <header id="top" className="relative min-h-screen flex items-center justify-center px-6 pb-20 overflow-hidden" style={{ paddingTop: '8rem' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full" style={{ background: 'radial-gradient(ellipse,rgba(234,88,12,0.1) 0%,transparent 70%)' }} />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(ellipse,rgba(234,88,12,0.06) 0%,transparent 70%)' }} />
        </div>

        <div className="relative z-10 mx-auto text-center" style={{ maxWidth: '64rem' }}>
          <div className="inline-flex items-center gap-2 bg-orange-600/10 ring-1 ring-orange-600/20 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-10">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 pulse-dot" />
            Waitlist open
          </div>

          <h1 className="font-display font-bold mb-8" style={{ fontSize: 'clamp(3.5rem,6vw,5.5rem)', letterSpacing: '-0.04em', lineHeight: '0.88' }}>
            Music that<br /><span className="text-orange-500">pays artists.</span>
          </h1>

          <p className="text-zinc-400 text-lg md:text-xl leading-relaxed max-w-xl mx-auto mb-5 font-medium">
            Upload your music. Keep <strong className="text-white font-bold">90%</strong> of every sale. No monthly fee. No labels.
          </p>
          <p className="t-muted text-sm max-w-md mx-auto mb-12">
            For independent and unsigned artists only. We&apos;re building this now — founding artists get first access.
          </p>

          <div id="signup" className="max-w-md mx-auto" style={{ scrollMarginTop: '6rem' }}>
            {/* Primary form */}
            {wPhase === 'form' && (
              <div className="flex flex-col sm:flex-row gap-3">
                <input ref={heroEmailRef} type="email" value={heroEmail} onChange={e => { setHeroEmail(e.target.value); setHeroInvalid(false) }}
                  onKeyDown={e => e.key === 'Enter' && submitHero()}
                  placeholder="your@email.com" autoComplete="email"
                  className={`flex-1 bg-zinc-900 ring-1 ring-white/[0.08] border rounded-2xl px-5 py-4 text-sm text-white placeholder-zinc-600 transition-all ${heroInvalid ? 'border-red-500' : 'border-transparent'}`} />
                <button onClick={submitHero} disabled={heroSending}
                  className="bg-orange-600 hover:bg-orange-500 text-black font-bold text-sm px-7 py-4 rounded-2xl transition-colors shadow-xl shadow-orange-600/25 whitespace-nowrap disabled:opacity-70">
                  {heroSending ? 'Sending…' : 'Join the waitlist →'}
                </button>
              </div>
            )}

            {/* Success */}
            {wPhase === 'success' && (
              <div className="inline-flex items-center gap-3 bg-orange-600/10 ring-1 ring-orange-600/20 rounded-2xl px-6 py-4">
                <svg width="16" height="16" fill="none" stroke="#ea580c" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                <span className="text-orange-400 font-bold text-sm">You&apos;re on the list. We&apos;ll be in touch.</span>
              </div>
            )}

            {/* Overflow */}
            {wPhase === 'overflow' && (
              <div className="text-left">
                <h3 className="font-display text-2xl md:text-3xl font-bold tracking-[-0.02em] text-white mb-2 text-center">The founding 1,000 are in.</h3>
                <p className="text-zinc-400 text-sm leading-relaxed mb-6 text-center">Leave your email and we&apos;ll let you know when we open to everyone.</p>
                {ovPhase === 'form' ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input type="email" value={heroOvEmail} onChange={e => { setHeroOvEmail(e.target.value); setHeroOvInvalid(false) }}
                      onKeyDown={e => e.key === 'Enter' && submitHeroOv()}
                      placeholder="your@email.com" autoComplete="email"
                      className={`flex-1 bg-zinc-900 ring-1 ring-white/[0.08] border rounded-2xl px-5 py-4 text-sm text-white placeholder-zinc-600 transition-all ${heroOvInvalid ? 'border-red-500' : 'border-transparent'}`} />
                    <button onClick={submitHeroOv} disabled={heroOvSending}
                      className="bg-orange-600 hover:bg-orange-500 text-black font-bold text-sm px-7 py-4 rounded-2xl transition-colors shadow-xl shadow-orange-600/25 whitespace-nowrap disabled:opacity-70">
                      {heroOvSending ? 'Sending…' : 'Notify me →'}
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="inline-flex items-center gap-3 bg-orange-600/10 ring-1 ring-orange-600/20 rounded-2xl px-6 py-4">
                      <svg width="16" height="16" fill="none" stroke="#ea580c" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                      <span className="text-orange-400 font-bold text-sm">We&apos;ll let you know when we open to everyone.</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="text-zinc-700 text-xs mt-4 font-medium">
              No spam, ever &nbsp;·&nbsp; Unsubscribe anytime &nbsp;·&nbsp;{' '}
              <Link href="/privacy" className="hover:text-zinc-500 transition-colors">Privacy Policy</Link>
            </p>
          </div>
        </div>

        <a href="#real-cost" className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-25 hover:opacity-50 transition-opacity cursor-pointer">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="animate-bounce">
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </a>
      </header>

      {/* ── STATS ────────────────────────────────────────────────── */}
      <section className="relative py-10 md:py-16">
        <div className="line" />
        <div className="max-w-4xl mx-auto px-6 md:px-14 py-8 md:py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
            <div className="reveal">
              <p className="font-display text-4xl font-bold text-white tracking-tight">90%</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mt-2">Revenue to you</p>
            </div>
            <div className="reveal reveal-delay-1">
              <p className="font-display text-4xl font-bold text-orange-500 tracking-tight">£0</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mt-2">Monthly fee, ever</p>
            </div>
            <div className="reveal reveal-delay-2">
              <p className="font-display text-4xl font-bold text-orange-500 tracking-tight">{spacesLeft}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mt-2">Founding spaces left</p>
            </div>
            <div className="reveal reveal-delay-3">
              <p className="font-display text-4xl font-bold text-white tracking-tight">100%</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mt-2">You own your music</p>
            </div>
          </div>
        </div>
        <div className="line" />
      </section>

      {/* ── THE COST ─────────────────────────────────────────────── */}
      <section id="real-cost" className="py-16 md:py-36" style={{ scrollMarginTop: '5rem' }}>
        <div className="max-w-5xl mx-auto px-6 md:px-14">

          <div className="text-center mb-12 reveal">
            <span className="inline-flex items-center gap-2 bg-orange-600/8 ring-1 ring-orange-600/15 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-6">
              The real cost of being independent
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[0.92]">
              You already pay<br />for a lot.
            </h2>
          </div>

          <div ref={costCardRef} className="reveal punchline ring-1 ring-white/[0.05] rounded-3xl overflow-hidden">
            <div className="px-8 py-14 md:py-20">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] t-faint mb-10 text-center">Before a single fan hears your music</p>
              <div className="text-center">
                <p className={`tw-line font-display text-2xl md:text-4xl font-bold text-white tracking-[-0.02em] leading-tight${twFading ? ' tw-fading' : ''}`} style={{ minHeight: '1.3em' }}>
                  <span id="typewriterText">{twText}</span>
                  <span className="tw-caret" aria-hidden="true">|</span>
                </p>
                <p className="font-display text-2xl md:text-4xl font-bold tracking-[-0.02em] leading-tight mt-3" style={{ color: '#F56D00' }}>
                  Insound is free.
                </p>
              </div>
            </div>
            <div className="border-t px-8 py-5 flex justify-between items-center" style={{ borderColor: 'var(--line-color)' }}>
              <span className="text-white font-bold">Typical annual total</span>
              <span className="text-orange-500 font-bold">£2,000 – £8,000+</span>
            </div>
            <div className="mx-0 bg-orange-600/8 border-t border-orange-600/15 px-8 py-6 flex justify-between items-center">
              <div>
                <p className="text-white font-bold">Publishing your music on Insound</p>
                <p className="text-[11px] t-muted mt-1">We keep 10% per sale — for development, storage, and coffee. That&apos;s it.</p>
              </div>
              <span className="text-orange-400 font-display font-bold text-2xl tracking-tight ml-6 flex-shrink-0">£0 to publish</span>
            </div>
          </div>

        </div>
      </section>
      <div className="line" />

      {/* ── THE MATH ─────────────────────────────────────────────── */}
      <section id="the-math" className="py-28 md:py-36">
        <div className="max-w-5xl mx-auto px-6 md:px-14">

          <div className="text-center mb-16 reveal">
            <span className="inline-flex items-center gap-2 bg-orange-600/8 ring-1 ring-orange-600/15 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-6">The honest truth</span>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[0.92] mb-5">Here&apos;s what you keep.</h2>
            <p className="text-zinc-500 text-lg max-w-lg mx-auto">A fan spends £10 on your music. How much reaches you?</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 reveal">
            <div className="col-good border rounded-3xl p-8 text-center relative" style={{ boxShadow: '0 8px 40px rgba(234,88,12,0.22),0 0 0 1px rgba(234,88,12,0.14)' }}>
              <p className="font-display text-5xl md:text-6xl font-bold tracking-[-0.03em] text-orange-500">£9.00</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400/80 mt-4">To the artist</p>
            </div>
            <div className="col-good border rounded-3xl p-8 text-center">
              <p className="font-display text-5xl md:text-6xl font-bold tracking-[-0.03em] text-white">80p</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mt-4">Insound</p>
            </div>
            <div className="col-good border rounded-3xl p-8 text-center">
              <p className="font-display text-5xl md:text-6xl font-bold tracking-[-0.03em] text-white">20p</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mt-4">Stripe fee</p>
            </div>
          </div>

          <p className="text-zinc-500 text-sm leading-relaxed max-w-2xl mx-auto text-center mt-6 mb-10 reveal">
            Stripe&apos;s fee is 1.5% + 20p per transaction. Shown transparently at checkout. No markup. Just the actual cost, passed through at cost.
          </p>

          {/* Comparison cards */}
          <div className="compare-cards reveal mt-4">

            {/* Card 1 – Streaming */}
            <article className="compare-card border rounded-3xl overflow-hidden">
              <div className="px-6 pt-6 pb-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] t-faint">Platform 01</p>
                <p className="font-display text-xl font-bold text-white mt-1">Streaming</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Spotify, Apple Music, Tidal</p>
              </div>
              <div className="grid grid-cols-2 mt-4">
                <div className="col-bad p-5 border-t border-r border-white/[0.04]">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-red-400/70 mb-4">Them</p>
                  <div className="space-y-4">
                    <div><p className="text-[10px] text-zinc-600 mb-1">Artist cut</p><p className="font-bold text-red-400 text-xs leading-snug">~£0.003 per stream</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">To earn £1,000</p><p className="font-bold text-red-400 text-xs leading-snug">333,000+ streams</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Pricing control</p><p className="font-bold text-red-400 text-xs leading-snug">None — platform decides</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Fan relationship</p><p className="font-bold text-red-400 text-xs leading-snug">Anonymous</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Who it&apos;s for</p><p className="font-bold text-red-400 text-xs leading-snug">Everyone</p></div>
                  </div>
                </div>
                <div className="col-good p-5 border-t border-white/[0.04]">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-orange-400 mb-4">insound.</p>
                  <div className="space-y-4">
                    <div><p className="text-[10px] text-zinc-600 mb-1">Artist cut</p><p className="font-bold text-orange-400 text-xs leading-snug">90% of every sale</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">To earn £1,000</p><p className="font-bold text-orange-400 text-xs leading-snug">~112 sales</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Pricing control</p><p className="font-bold text-orange-400 text-xs leading-snug">You set your price</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Fan relationship</p><p className="font-bold text-orange-400 text-xs leading-snug">Direct — you own it</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Who it&apos;s for</p><p className="font-bold text-orange-400 text-xs leading-snug">Independent artists only</p></div>
                  </div>
                </div>
              </div>
            </article>

            {/* Card 2 – Bandcamp */}
            <article className="compare-card border rounded-3xl overflow-hidden">
              <div className="px-6 pt-6 pb-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] t-faint">Platform 02</p>
                <p className="font-display text-xl font-bold text-white mt-1">Bandcamp</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">The old indie standard</p>
              </div>
              <div className="grid grid-cols-2 mt-4">
                <div className="col-bad p-5 border-t border-r border-white/[0.04]">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-red-400/70 mb-4">Them</p>
                  <div className="space-y-4">
                    <div><p className="text-[10px] text-zinc-600 mb-1">Artist cut</p><p className="font-bold text-red-400 text-xs leading-snug">~80% after all fees</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Revenue threshold</p><p className="font-bold text-red-400 text-xs leading-snug">Higher rate only after $5k in sales</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Platform future</p><p className="font-bold text-red-400 text-xs leading-snug">Sold twice since 2022</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Who it&apos;s for</p><p className="font-bold text-red-400 text-xs leading-snug">Everyone, including labels</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Holds your money</p><p className="font-bold text-red-400 text-xs leading-snug">Yes</p></div>
                  </div>
                </div>
                <div className="col-good p-5 border-t border-white/[0.04]">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-orange-400 mb-4">insound.</p>
                  <div className="space-y-4">
                    <div><p className="text-[10px] text-zinc-600 mb-1">Artist cut</p><p className="font-bold text-orange-400 text-xs leading-snug">90% — always</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Revenue threshold</p><p className="font-bold text-orange-400 text-xs leading-snug">None — 90% from sale one</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Platform future</p><p className="font-bold text-orange-400 text-xs leading-snug">Independent, no investors</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Who it&apos;s for</p><p className="font-bold text-orange-400 text-xs leading-snug">Independent &amp; unsigned only</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Holds your money</p><p className="font-bold text-orange-400 text-xs leading-snug">Never</p></div>
                  </div>
                </div>
              </div>
            </article>

            {/* Card 3 – Mirlo */}
            <article className="compare-card border rounded-3xl overflow-hidden">
              <div className="px-6 pt-6 pb-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] t-faint">Platform 03</p>
                <p className="font-display text-xl font-bold text-white mt-1">Mirlo</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Donation-funded co-op</p>
              </div>
              <div className="grid grid-cols-2 mt-4">
                <div className="col-bad p-5 border-t border-r border-white/[0.04]">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-red-400/70 mb-4">Them</p>
                  <div className="space-y-4">
                    <div><p className="text-[10px] text-zinc-600 mb-1">Cost to join</p><p className="font-bold text-red-400 text-xs leading-snug">Free</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Artist cut</p><p className="font-bold text-red-400 text-xs leading-snug">7% fee + Stripe fees</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Payment setup</p><p className="font-bold text-red-400 text-xs leading-snug">Requires Stripe — complex onboarding</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Platform stability</p><p className="font-bold text-red-400 text-xs leading-snug">Donation-funded, no guaranteed runway</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Who it&apos;s for</p><p className="font-bold text-red-400 text-xs leading-snug">Solidarity economy focus</p></div>
                  </div>
                </div>
                <div className="col-good p-5 border-t border-white/[0.04]">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-orange-400 mb-4">insound.</p>
                  <div className="space-y-4">
                    <div><p className="text-[10px] text-zinc-600 mb-1">Cost to join</p><p className="font-bold text-orange-400 text-xs leading-snug">Free</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Artist cut</p><p className="font-bold text-orange-400 text-xs leading-snug">10% flat — nothing else</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Payment setup</p><p className="font-bold text-orange-400 text-xs leading-snug">Stripe Connect, guided setup</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Platform stability</p><p className="font-bold text-orange-400 text-xs leading-snug">Independently built, sustainable model</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-1">Who it&apos;s for</p><p className="font-bold text-orange-400 text-xs leading-snug">Any independent artist</p></div>
                  </div>
                </div>
              </div>
            </article>

          </div>
          <div className="compare-snap-dots md:hidden" aria-hidden="true"><span /><span /><span /></div>

          <div className="mt-20 md:mt-28 text-center reveal">
            <h3 className="font-display text-4xl md:text-6xl font-bold tracking-[-0.03em] leading-[0.95]">
              No upfront cost.<br />No monthly fee.<br /><span className="text-orange-500">No risk.</span>
            </h3>
            <p className="t-muted text-base md:text-lg mt-6 max-w-xl mx-auto leading-relaxed">Free to join. Free to upload. You only pay when a fan pays you.</p>
          </div>

        </div>
      </section>

      {/* ── CALCULATOR ───────────────────────────────────────────── */}
      <section className="pb-28">
        <div className="max-w-5xl mx-auto px-6 md:px-14">
          <div className="reveal punchline ring-1 ring-white/[0.05] rounded-3xl p-8 md:p-10">

            <div className="text-center mb-8">
              <span className="inline-flex items-center gap-2 bg-orange-600/8 ring-1 ring-orange-600/15 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-4">Run your numbers</span>
              <h3 className="font-display text-2xl md:text-3xl font-bold tracking-[-0.02em]">What would you actually earn?</h3>
            </div>

            <div className="mb-10">
              <div className="flex justify-between items-end mb-4">
                <p className="text-sm font-semibold t-muted">Price per release</p>
                <p className="font-display text-4xl font-bold text-orange-500 tracking-tight">{currSym}{calcPrice}</p>
              </div>
              <input type="range" min={1} max={50} value={calcPrice}
                onChange={e => setCalcPrice(parseInt(e.target.value))}
                className="calc-slider w-full"
                style={{ '--fill': calcFill } as React.CSSProperties} />
              <div className="flex justify-between text-[10px] t-faint mt-2 font-medium">
                <span>{currSym}1 minimum</span><span>{currSym}50</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="rounded-2xl p-4 text-center bg-red-500/5 ring-1 ring-red-500/10">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-red-400/60 mb-3">Streaming</p>
                <p className="font-display text-xl font-bold text-red-400">{calcStreamLbl}</p>
                <p className="text-[10px] t-faint mt-1 leading-snug">streams to match<br />one sale</p>
              </div>
              <div className="rounded-2xl p-4 text-center ring-1" style={{ background: 'rgba(255,255,255,0.02)', '--tw-ring-color': 'rgba(255,255,255,0.06)' } as React.CSSProperties}>
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] t-faint mb-3">Bandcamp</p>
                <p className="font-display text-xl font-bold t-subtle">{calcBcPer}</p>
                <p className="text-[10px] t-faint mt-1 leading-snug">per sale<br />(after fees)</p>
              </div>
              <div className="rounded-2xl p-4 text-center bg-orange-600/5 ring-1 ring-orange-600/10">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-orange-400/60 mb-3">Insound</p>
                <p className="font-display text-xl font-bold text-orange-400">{calcInPer}</p>
                <p className="text-[10px] t-faint mt-1 leading-snug">per sale,<br />always</p>
              </div>
            </div>

            <div className="border-t pt-6 text-center" style={{ borderColor: 'var(--line-color)' }}>
              <p className="t-muted text-sm mb-4">To earn <strong className="text-white font-bold">£1,000</strong> at this price:</p>
              <div className="flex items-center justify-center gap-4 sm:gap-8 flex-wrap">
                <div className="text-center">
                  <p className="font-display text-2xl font-bold text-red-400">333,000+</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest t-faint mt-1">streams</p>
                </div>
                <p className="font-display text-lg t-faint font-bold">vs</p>
                <div className="text-center">
                  <p className="font-display text-2xl font-bold t-subtle">{calcBcSales}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest t-faint mt-1">Bandcamp sales</p>
                </div>
                <p className="font-display text-lg t-faint font-bold">vs</p>
                <div className="text-center">
                  <p className="font-display text-2xl font-bold text-orange-500">{calcInSales}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest t-faint mt-1">Insound sales</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <div className="line" />
      <section id="how-it-works" className="py-28 md:py-36 relative">
        <div className="max-w-4xl mx-auto px-6 md:px-14">

          <div className="text-center mb-16 reveal">
            <span className="inline-flex items-center gap-2 bg-orange-600/8 ring-1 ring-orange-600/15 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-6">How it works</span>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em]">Up and running<br />in minutes.</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="reveal card ring-1 ring-white/[0.05] rounded-3xl p-8">
              <div className="w-10 h-10 bg-orange-600/15 ring-1 ring-orange-600/15 rounded-2xl flex items-center justify-center mb-6">
                <svg width="18" height="18" fill="none" stroke="#ea580c" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              </div>
              <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500/70 mb-3">Step 1</p>
              <h3 className="font-display text-xl font-bold tracking-tight mb-3">Upload your music</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">WAV, FLAC, AIFF or MP3. Your artist page goes live instantly — share the link anywhere.</p>
            </div>
            <div className="reveal reveal-delay-1 card ring-1 ring-white/[0.05] rounded-3xl p-8">
              <div className="w-10 h-10 bg-orange-600/15 ring-1 ring-orange-600/15 rounded-2xl flex items-center justify-center mb-6">
                <span className="text-orange-500 font-bold text-base leading-none">£</span>
              </div>
              <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500/70 mb-3">Step 2</p>
              <h3 className="font-display text-xl font-bold tracking-tight mb-3">Set your price</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">You decide what your music is worth. Minimum £2. No ceiling. Stripe&apos;s fee (1.5% + 20p) is shown transparently at checkout — no markup, no hidden deductions.</p>
            </div>
            <div className="reveal reveal-delay-2 card ring-1 ring-white/[0.05] rounded-3xl p-8">
              <div className="w-10 h-10 bg-orange-600/15 ring-1 ring-orange-600/15 rounded-2xl flex items-center justify-center mb-6">
                <svg width="18" height="18" fill="none" stroke="#ea580c" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
              </div>
              <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500/70 mb-3">Step 3</p>
              <h3 className="font-display text-xl font-bold tracking-tight mb-3">Get paid</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">90% of every sale goes straight to you, the moment it completes. Withdraw anytime. No thresholds, no delays, no surprises.</p>
            </div>
          </div>

          <div className="reveal mt-6 card ring-1 ring-white/[0.05] rounded-3xl p-8 flex flex-col sm:flex-row items-start gap-6">
            <div className="w-10 h-10 flex-shrink-0 bg-orange-600/15 ring-1 ring-orange-600/15 rounded-2xl flex items-center justify-center">
              <svg width="18" height="18" fill="none" stroke="#ea580c" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            </div>
            <div>
              <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500/70 mb-3">Step 4</p>
              <h3 className="font-display text-xl font-bold tracking-tight mb-3">Get discovered</h3>
              <p className="text-zinc-500 text-sm leading-relaxed max-w-xl">Your artist page is public from the moment you upload. Fans browse Insound, find your music, and buy direct — no algorithm deciding who gets heard. You build the audience. You own the relationship.</p>
            </div>
          </div>

        </div>
      </section>

      {/* ── TRUST ────────────────────────────────────────────────── */}
      <section className="pb-16">
        <div className="max-w-5xl mx-auto px-6 md:px-14">
          <div className="reveal punchline ring-1 ring-white/[0.05] rounded-3xl p-8 md:p-12">
            <h3 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[0.92] mb-5">Built different.</h3>
            <p className="t-muted text-base leading-relaxed mb-5">Bandcamp was sold to Epic Games in 2022. Then sold again to Songtradr in 2023, who laid off most of the team within weeks. By Q1 2026, active Bandcamp stores had declined 50% quarter-over-quarter. The platform artists trusted most became a cautionary tale in under three years.</p>
            <p className="text-white font-medium leading-relaxed mb-5">We&apos;re building Insound independently. No investors. No exit strategy. No cap table that could ever change the 90% split. Just a platform that works for artists, permanently.</p>
            <p className="t-muted text-base leading-relaxed">Sign up now and your 90% starts from your first sale. No thresholds, no waiting, no asterisks.</p>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section className="py-28 md:py-36">
        <div className="max-w-5xl mx-auto px-6 md:px-14">

          <div className="text-center mb-16 reveal">
            <span className="inline-flex items-center gap-2 bg-orange-600/8 ring-1 ring-orange-600/15 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-6">FAQ</span>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[0.92]">Good questions.</h2>
          </div>

          <div className="faq-layout flex items-center" style={{ flexDirection: 'row', gap: '4rem', flexWrap: 'wrap' }}>

            {/* Phone mockup */}
            <div className="faq-phone" style={{ flexShrink: 0, width: '270px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: '270px' }}>
                {/* Glow */}
                <div className="device-glow" style={{ position: 'absolute', inset: '-60px', background: 'radial-gradient(ellipse,rgba(234,88,12,0.18) 0%,transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />

                {/* Floating sale toast */}
                <div className="floating-card" style={{ position: 'absolute', left: '-155px', top: '80px', zIndex: 6, width: '150px', background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(16px)', border: '1px solid rgba(234,88,12,0.25)', borderRadius: '16px', padding: '11px 12px', boxShadow: '0 16px 40px rgba(0,0,0,0.5)', animation: 'floatA 4.5s ease-in-out infinite' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '7px', background: 'rgba(234,88,12,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="10" height="10" fill="none" stroke="#ea580c" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.85)', fontFamily: 'system-ui' }}>Sale received</span>
                  </div>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#f97316', letterSpacing: '-0.02em', fontFamily: "'Space Grotesk',system-ui" }}>£7.20</span>
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', fontFamily: 'system-ui', display: 'block', marginTop: '2px' }}>Midnight Drive</span>
                </div>

                {/* Floating earnings card */}
                <div className="floating-card" style={{ position: 'absolute', left: '-140px', bottom: '100px', zIndex: 6, width: '135px', background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '11px 12px', boxShadow: '0 16px 40px rgba(0,0,0,0.5)', animation: 'floatB 5.5s ease-in-out infinite' }}>
                  <p style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', marginBottom: '4px', fontFamily: 'system-ui' }}>This month</p>
                  <p style={{ fontSize: '22px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: '5px', fontFamily: "'Space Grotesk',system-ui" }}>£247.50</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <svg width="9" height="9" fill="none" stroke="#22c55e" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15" /></svg>
                    <span style={{ fontSize: '9px', color: '#22c55e', fontWeight: 600, fontFamily: 'system-ui' }}>23 sales</span>
                  </div>
                </div>

                {/* Phone shell */}
                <div className="phone-device" style={{ position: 'relative', zIndex: 1, width: '270px', height: '568px', borderRadius: '44px' }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '44px', overflow: 'hidden', background: '#050505' }}>

                    {/* Dynamic island */}
                    <div style={{ position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)', width: '88px', height: '26px', background: '#000', borderRadius: '20px', zIndex: 10 }} />

                    {/* Status bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 22px 0', fontSize: '11px', color: 'rgba(255,255,255,0.75)', fontWeight: 600, fontFamily: 'system-ui,sans-serif' }}>
                      <span>{phoneTime}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="14" height="10" viewBox="0 0 24 16" fill="none">
                          <path d="M1 7.5C4.5 3 8.5 1 12 1s7.5 2 11 6.5" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" />
                          <path d="M4.5 11C7 8 9.5 6.5 12 6.5s5 1.5 7.5 4.5" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" />
                          <circle cx="12" cy="15" r="1.5" fill="rgba(255,255,255,0.6)" />
                        </svg>
                        <div style={{ width: '22px', height: '11px', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: '3px', position: 'relative', display: 'flex', alignItems: 'center', padding: '1px 1.5px' }}>
                          <div style={{ width: '13px', height: '6px', background: 'rgba(255,255,255,0.7)', borderRadius: '1.5px' }} />
                          <div style={{ position: 'absolute', right: '-4px', top: '50%', transform: 'translateY(-50%)', width: '3px', height: '5px', background: 'rgba(255,255,255,0.35)', borderRadius: '0 2px 2px 0' }} />
                        </div>
                      </div>
                    </div>

                    {/* App bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 18px 10px' }}>
                      <span style={{ fontFamily: "'Space Grotesk',system-ui,sans-serif", fontSize: '16px', fontWeight: 700, color: '#f97316', letterSpacing: '-0.02em' }}>insound<span style={{ color: '#f97316' }}>.</span></span>
                      <div style={{ position: 'relative', width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="13" height="13" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 01-8 0" /></svg>
                        {basket.length > 0 && (
                          <div style={{ position: 'absolute', top: '-3px', right: '-3px', width: '16px', height: '16px', borderRadius: '50%', background: '#ea580c', color: '#000', fontSize: '8px', fontWeight: 800, fontFamily: 'system-ui', lineHeight: '16px', textAlign: 'center' }}>
                            {basket.length}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Banner */}
                    <div style={{ margin: '0 12px', borderRadius: '18px', overflow: 'hidden', position: 'relative', height: '136px' }}>
                      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg,${banner.color1} 0%,${banner.color2} 60%,#050505 100%)`, transition: 'background 0.5s ease' }} />
                      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 25% 60%,rgba(${banner.glow},0.28) 0%,transparent 55%)`, transition: 'background 0.5s ease' }} />
                      <div style={{ position: 'absolute', bottom: '42px', left: '14px', right: '14px', height: '28px', display: 'flex', alignItems: 'center', gap: '2px', opacity: 0.22 }}>
                        {[8,15,22,10,26,17,7,21,28,12,20,9,24,14,19,28,11,16,23,8].map((h, i) => (
                          <div key={i} style={{ width: '2px', height: `${h}px`, background: banner.color1, borderRadius: '1px' }} />
                        ))}
                      </div>
                      <div style={{ position: 'absolute', bottom: '13px', left: '14px' }}>
                        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'system-ui,sans-serif', marginBottom: '4px' }}>Artist page</p>
                        <p style={{ fontSize: '20px', fontWeight: 700, color: 'white', lineHeight: 1, letterSpacing: '-0.02em', fontFamily: "'Space Grotesk',system-ui,sans-serif" }}>YOUTH</p>
                        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'system-ui,sans-serif' }}>Indie · 6 releases</p>
                      </div>
                    </div>

                    {/* Track list */}
                    <div style={{ padding: '12px 14px 0', fontFamily: 'system-ui,sans-serif' }}>
                      <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.18)', marginBottom: '8px', padding: '0 2px' }}>Releases</p>
                      {TRACKS.map((track, i) => {
                        const inBasket = basket.includes(track.name)
                        return (
                          <div key={track.name}
                            className={`device-track${activeTrack === track.name ? ' active' : ''}`}
                            onClick={() => selectTrack(track)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 2px', borderBottom: i < TRACKS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : undefined, cursor: 'pointer', borderRadius: '8px', transition: 'background 0.15s ease' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'none' }}>
                              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `linear-gradient(135deg,${track.color1},${track.color2})`, flexShrink: 0 }} />
                              <div>
                                <p style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.88)', lineHeight: 1.2 }}>{track.name}</p>
                                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginTop: '1px' }}>{track.type} · {track.year}</p>
                              </div>
                            </div>
                            <div className={`device-price${inBasket ? ' in-basket' : ''}`}
                              onClick={e => { e.stopPropagation(); toggleBasket(track.name) }}
                              style={{ background: inBasket ? 'transparent' : (i === 0 ? track.color1 : 'rgba(255,255,255,0.07)'), color: inBasket ? '#22c55e' : (i === 0 ? '#000' : 'rgba(255,255,255,0.6)'), fontSize: '10px', fontWeight: 700, padding: '5px 11px', borderRadius: '20px', flexShrink: 0, cursor: 'pointer', transition: 'transform 0.15s ease' }}>
                              {inBasket ? '✓' : `£${track.price}`}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Bottom nav */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '62px', background: 'rgba(5,5,5,0.97)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 24px 10px' }}>
                      <svg width="20" height="20" fill="none" stroke="#ea580c" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                      <svg width="20" height="20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                      <svg width="20" height="20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>
                      <svg width="20" height="20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    </div>
                  </div>
                  {/* Side buttons */}
                  <div style={{ position: 'absolute', top: '108px', right: '-3px', width: '3px', height: '62px', background: 'rgba(255,255,255,0.08)', borderRadius: '0 2px 2px 0' }} />
                  <div style={{ position: 'absolute', top: '90px', left: '-3px', width: '3px', height: '36px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px 0 0 2px' }} />
                  <div style={{ position: 'absolute', top: '136px', left: '-3px', width: '3px', height: '36px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px 0 0 2px' }} />
                </div>
              </div>
            </div>

            {/* FAQ list */}
            <div className="faq-list flex-1 space-y-0 reveal">
              {[
                { q: 'When does Insound launch?', a: "We're in development now. Founding members get first access before we open to everyone — that's what the waitlist is for." },
                { q: 'Is the 90% rate permanent?', a: "Yes. It's not a launch promotion or an introductory offer — it's the whole business model. We keep 10% to cover development, storage, and the team. That's the deal, permanently." },
                { q: 'How do I get paid?', a: "90% goes directly to your Stripe account the moment a sale completes — we never hold it. Your Stripe balance is yours immediately. Withdrawals to your bank follow Stripe's standard payout schedule, typically 2–7 days depending on your account settings. No minimum thresholds, no delays on our end." },
                { q: 'Does Insound hold my money?', a: "Never. We use Stripe Connect direct charges — when a fan buys your music, the payment is created directly in your Stripe account. We take our 10% as an application fee at the point of sale. Your money is yours from the moment the transaction completes. We are never in the middle." },
                { q: 'Do I keep my masters?', a: 'Always. Uploading to Insound gives us nothing except permission to host and sell your music on your behalf. You own everything, forever.' },
                { q: 'What formats do you accept?', a: 'WAV, FLAC, AIFF, and MP3. We recommend lossless where possible — your fans deserve the best quality.' },
                { q: 'Is there a subscription fee?', a: "No. It's free to publish. We only make money when you make money — 10% per sale, nothing else." },
                { q: 'Are there any hidden fees?', a: 'None. We take 10% per sale. Stripe charges 1.5% + 20p per transaction — shown clearly at checkout and passed through at cost. No markup on the Stripe fee. What you see is what happens.' },
              ].map((item, i, arr) => (
                <div key={i} className={`${i < arr.length - 1 ? 'border-b' : ''} py-6`} style={{ borderColor: 'var(--line-color)' }}>
                  <p className="font-display font-bold text-lg text-white mb-2">{item.q}</p>
                  <p className="t-muted text-sm leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>
      <div className="line" />

      {/* ── ROADMAP ───────────────────────────────────────────────── */}
      <section className="py-28 md:py-36">
        <div className="max-w-5xl mx-auto px-6 md:px-14">

          <div className="text-center mb-16 reveal">
            <span className="inline-flex items-center gap-2 bg-orange-600/8 ring-1 ring-orange-600/15 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-6">The roadmap</span>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[0.92]">What we&apos;re building.</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4 reveal">

            <div className="punchline ring-1 ring-white/[0.05] rounded-3xl p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-6">Completed</p>
              <ul className="roadmap-list done">
                {['Artist music upload (WAV, FLAC, AIFF, MP3).', 'Stripe Connect direct payments — we never hold your money.', 'Artist pages with sharing and track downloads.', 'Founding artist waitlist (1,000 spaces).'].map((item, i) => (
                  <li key={i}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="punchline ring-1 ring-white/[0.05] rounded-3xl p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400 mb-6">In progress</p>
              <ul className="roadmap-list active">
                {['Persistent music player.', 'Fan libraries — your purchased music, always available.', 'Artist dashboard and analytics.', 'Frictionless fan accounts — buy music without signing up.', 'Pay what you want pricing.'].map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="punchline ring-1 ring-white/[0.05] rounded-3xl p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-6">Coming soon</p>
              <ul className="roadmap-list">
                {['Artist-fulfilled merch with tracked shipping.', 'Insound Selects — human-curated discovery.', 'Genre mood board for fans.', 'Artist recommendation profiles.', 'First sale milestone moment for artists.', 'Pre-orders.', 'Private and unlisted releases.', 'Download codes for gigs and merch.'].map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="punchline ring-1 ring-white/[0.05] rounded-3xl p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-6">On the roadmap</p>
              <ul className="roadmap-list">
                {['Progressive Web App (PWA).', 'Taste-based discovery (once we have the data).', 'Embedded player.', 'Pages for artists, fans, and press.'].map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="punchline ring-1 ring-white/[0.05] rounded-3xl p-8 md:col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-6">If there&apos;s demand</p>
              <ul className="roadmap-list">
                <li>
                  <span className="font-bold block mb-1">Insound for Collectives.</span>
                  <span className="t-muted block">Shared pages and split wallets for bands, duos, and artist collectives. Same 10% model. Community-owned, artist-run. Not for labels — never for labels.</span>
                </li>
              </ul>
            </div>

          </div>
        </div>
      </section>
      <div className="line" />

      {/* ── BOTTOM CTA ───────────────────────────────────────────── */}
      <section className="py-28 md:py-36">
        <div className="max-w-2xl mx-auto px-6 text-center">

          <div className="reveal">
            <div className="inline-flex items-center gap-2 bg-orange-600/10 ring-1 ring-orange-600/20 text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-10">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 pulse-dot" />
              Waitlist open
            </div>
            <h2 className="font-display text-4xl md:text-6xl font-bold tracking-[-0.04em] leading-[0.9] mb-6">Your music.<br />Your money.</h2>
            <p className="text-zinc-400 text-lg leading-relaxed mb-10 max-w-sm mx-auto">
              Sign up now and get first access when we launch. 90% is the model — not a launch offer. Your rate starts from your first sale. No thresholds. No asterisks.
            </p>
          </div>

          <div className="reveal reveal-delay-1">
            {wPhase === 'form' && (
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-4">
                <input type="email" value={bottomEmail} onChange={e => { setBottomEmail(e.target.value); setBottomInvalid(false) }}
                  onKeyDown={e => e.key === 'Enter' && submitBottom()}
                  placeholder="your@email.com" autoComplete="email"
                  className={`flex-1 bg-zinc-900 ring-1 ring-white/[0.08] border rounded-2xl px-5 py-4 text-sm text-white placeholder-zinc-600 transition-all ${bottomInvalid ? 'border-red-500' : 'border-transparent'}`} />
                <button onClick={submitBottom} disabled={bottomSending}
                  className="bg-orange-600 hover:bg-orange-500 text-black font-bold text-sm px-7 py-4 rounded-2xl transition-colors shadow-xl shadow-orange-600/25 whitespace-nowrap disabled:opacity-70">
                  {bottomSending ? 'Sending…' : 'Join the waitlist →'}
                </button>
              </div>
            )}

            {wPhase === 'success' && (
              <div className="mb-4">
                <div className="inline-flex items-center gap-3 bg-orange-600/10 ring-1 ring-orange-600/20 rounded-2xl px-6 py-4">
                  <svg width="16" height="16" fill="none" stroke="#ea580c" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                  <span className="text-orange-400 font-bold text-sm">You&apos;re on the list. We&apos;ll be in touch.</span>
                </div>
              </div>
            )}

            {wPhase === 'overflow' && (
              <div className="mb-4">
                <h3 className="font-display text-2xl md:text-3xl font-bold tracking-[-0.02em] text-white mb-2">The founding 1,000 are in.</h3>
                <p className="text-zinc-400 text-sm leading-relaxed mb-6 max-w-sm mx-auto">Leave your email and we&apos;ll let you know when we open to everyone.</p>
                {ovPhase === 'form' ? (
                  <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                    <input type="email" value={bottomOvEmail} onChange={e => { setBottomOvEmail(e.target.value); setBottomOvInvalid(false) }}
                      onKeyDown={e => e.key === 'Enter' && submitBottomOv()}
                      placeholder="your@email.com" autoComplete="email"
                      className={`flex-1 bg-zinc-900 ring-1 ring-white/[0.08] border rounded-2xl px-5 py-4 text-sm text-white placeholder-zinc-600 transition-all ${bottomOvInvalid ? 'border-red-500' : 'border-transparent'}`} />
                    <button onClick={submitBottomOv} disabled={bottomOvSending}
                      className="bg-orange-600 hover:bg-orange-500 text-black font-bold text-sm px-7 py-4 rounded-2xl transition-colors shadow-xl shadow-orange-600/25 whitespace-nowrap disabled:opacity-70">
                      {bottomOvSending ? 'Sending…' : 'Notify me →'}
                    </button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <div className="inline-flex items-center gap-3 bg-orange-600/10 ring-1 ring-orange-600/20 rounded-2xl px-6 py-4">
                      <svg width="16" height="16" fill="none" stroke="#ea580c" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                      <span className="text-orange-400 font-bold text-sm">We&apos;ll let you know when we open to everyone.</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="text-zinc-700 text-xs font-medium">
              No spam, ever &nbsp;·&nbsp; Unsubscribe anytime &nbsp;·&nbsp;{' '}
              <Link href="/privacy" className="hover:text-zinc-500 transition-colors">Privacy Policy</Link>
            </p>
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
            <Link href="/for-press" className="hover:text-orange-500 transition-colors">Press</Link>
            <Link href="/privacy" className="hover:text-orange-500 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-orange-500 transition-colors">Terms</Link>
            <Link href="/ai-policy" className="hover:text-orange-500 transition-colors">AI Policy</Link>
          </div>
          <p className="text-zinc-700 text-[11px] font-medium">© 2026 Insound</p>
        </div>
      </footer>

    </main>
  )
}
