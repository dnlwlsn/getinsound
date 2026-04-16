'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      viewBox="0 0 24 24"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}

export default function AuthClient() {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<'login' | 'signup'>('login')

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginShowPw, setLoginShowPw] = useState(false)
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState('')

  // Signup state
  const [artistName, setArtistName] = useState('')
  const [slug, setSlug] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupShowPw, setSignupShowPw] = useState(false)
  const [attest, setAttest] = useState(false)
  const [terms, setTerms] = useState(false)
  const [signupBusy, setSignupBusy] = useState(false)
  const [signupError, setSignupError] = useState('')
  const [signupSuccess, setSignupSuccess] = useState(false)
  const [signupSuccessEmail, setSignupSuccessEmail] = useState('')

  const slugTouched = useRef(false)

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-generate slug from artist name
  function handleArtistNameChange(value: string) {
    setArtistName(value)
    if (!slugTouched.current) {
      setSlug(slugify(value))
    }
  }

  function handleSlugChange(value: string) {
    slugTouched.current = true
    setSlug(value)
  }

  // --- Login ---
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setLoginBusy(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      })
      if (error) throw error
      router.push('/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed.'
      setLoginError(message)
      setLoginBusy(false)
    }
  }

  // --- Signup ---
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setSignupError('')

    const trimmedSlug = slug.trim().toLowerCase()

    if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(trimmedSlug)) {
      setSignupError('URL must be 3-40 characters: lowercase letters, numbers, hyphens.')
      return
    }
    if (!attest) {
      setSignupError('Please confirm you are an independent, unsigned artist.')
      return
    }
    if (!terms) {
      setSignupError('Please accept the Privacy Policy and AI Content Policy.')
      return
    }

    setSignupBusy(true)

    try {
      // Pre-flight slug uniqueness check
      const { data: existing, error: slugErr } = await supabase
        .from('artists')
        .select('id')
        .eq('slug', trimmedSlug)
        .maybeSingle()
      if (slugErr) throw slugErr
      if (existing) {
        setSignupError(`"${trimmedSlug}" is already taken. Try another.`)
        setSignupBusy(false)
        return
      }

      const { error } = await supabase.auth.signUp({
        email: signupEmail.trim(),
        password: signupPassword,
        options: {
          data: {
            artist_name: artistName.trim(),
            slug: trimmedSlug,
            self_attest: true,
            independence_confirmed: true,
            independence_confirmed_at: new Date().toISOString(),
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })
      if (error) throw error

      setSignupSuccessEmail(signupEmail.trim())
      setSignupSuccess(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setSignupError(message)
      setSignupBusy(false)
    }
  }

  const PasswordToggle = ({ show, onToggle }: { show: boolean; onToggle: () => void }) => (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-4 top-[38px] text-zinc-600 hover:text-zinc-400 transition-colors"
    >
      {show ? (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  )

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)', backgroundSize: '48px 48px' }}>
      {/* Nav */}
      <nav className="sticky top-0 w-full z-50 flex justify-between items-center px-6 md:px-14 py-5 border-b border-zinc-900/80" style={{ background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <Link href="/" className="text-2xl font-black text-orange-600 tracking-tighter hover:text-orange-500 transition-colors font-display">
          insound.
        </Link>
        <div className="hidden md:flex gap-10 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
          <Link href="/explore" className="hover:text-orange-500 transition-colors">Explore</Link>
          <Link href="/why-us" className="hover:text-orange-500 transition-colors">Why Insound</Link>
          <Link href="/#how-it-works" className="hover:text-orange-500 transition-colors">How It Works</Link>
        </div>
        <div className="flex gap-3 items-center">
          <Link href="/auth" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors hidden sm:block">Sign In</Link>
          <Link href="/auth" className="bg-orange-600 text-black px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition-colors shadow-lg shadow-orange-600/20">Get Started</Link>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center p-6 relative">
        {/* Background gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(234,88,12,0.05),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(234,88,12,0.04),transparent_55%)] pointer-events-none" />

        {/* Back link */}
        <Link href="/" className="absolute top-6 left-6 text-zinc-600 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-bold">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Home
        </Link>

        <div className="w-full max-w-md relative z-10 animate-[slide-in-up_0.5s_ease_both]">
          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/" className="text-3xl font-black text-orange-600 tracking-tighter hover:text-orange-500 transition-colors font-display">
              insound.
            </Link>
            <p className="text-zinc-500 mt-2 font-medium text-sm">Independent music, directly supported.</p>
          </div>

          {/* Social proof strip */}
          <div className="flex items-center justify-center gap-3 mb-8 flex-wrap">
            <span className="bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">12,400+ Artists</span>
            <span className="bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest text-orange-500">&pound;890K+ Paid Out</span>
            <span className="bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Free Forever</span>
          </div>

          {/* Card */}
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl" style={{ boxShadow: '0 0 60px rgba(234,88,12,0.08)' }}>
            {/* Tabs */}
            <div className="flex gap-1 mb-8 bg-zinc-950 p-1 rounded-xl">
              <button
                onClick={() => { setTab('login'); setSignupSuccess(false) }}
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${tab === 'login' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setTab('signup'); setSignupSuccess(false) }}
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${tab === 'signup' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Create Account
              </button>
            </div>

            {/* Login Form */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Email Address</label>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600"
                  />
                </div>
                <div className="relative">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Password</label>
                  <input
                    type={loginShowPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm pr-12 focus:border-orange-600"
                  />
                  <PasswordToggle show={loginShowPw} onToggle={() => setLoginShowPw(!loginShowPw)} />
                </div>
                <div className="text-right">
                  <button type="button" className="text-xs text-zinc-500 hover:text-orange-500 transition-colors font-bold">Forgot password?</button>
                </div>
                <button
                  type="submit"
                  disabled={loginBusy}
                  className="w-full bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span>{loginBusy ? 'Signing in...' : 'Sign In'}</span>
                  {loginBusy && <Spinner />}
                </button>
                {loginError && (
                  <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-3">
                    {loginError}
                  </div>
                )}
              </form>
            )}

            {/* Signup Form */}
            {tab === 'signup' && !signupSuccess && (
              <form onSubmit={handleSignup} className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Artist Name</label>
                  <input
                    type="text"
                    placeholder="Band or stage name"
                    required
                    value={artistName}
                    onChange={(e) => handleArtistNameChange(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">URL</label>
                  <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-4 focus-within:border-orange-600 transition-colors">
                    <span className="text-zinc-600 text-sm select-none">getinsound.com/</span>
                    <input
                      type="text"
                      pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
                      placeholder="your-name"
                      required
                      value={slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      className="flex-1 bg-transparent py-3.5 outline-none text-white text-sm placeholder-zinc-700"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1.5">Lowercase letters, numbers and hyphens only.</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Email Address</label>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600"
                  />
                </div>
                <div className="relative">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Password</label>
                  <input
                    type={signupShowPw ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    minLength={8}
                    required
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 pr-12 focus:border-orange-600"
                  />
                  <PasswordToggle show={signupShowPw} onToggle={() => setSignupShowPw(!signupShowPw)} />
                </div>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    required
                    checked={attest}
                    onChange={(e) => setAttest(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-700 bg-zinc-950 text-orange-600 focus:ring-orange-600 focus:ring-offset-0"
                  />
                  <span className="text-xs text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">
                    I confirm that I am an <strong className="text-white">independent, unsigned artist</strong> and am not signing up on behalf of a record label, management company, or any entity with a commercial music distribution agreement.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    required
                    checked={terms}
                    onChange={(e) => setTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-700 bg-zinc-950 text-orange-600 focus:ring-orange-600 focus:ring-offset-0"
                  />
                  <span className="text-xs text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">
                    I agree to the <Link href="/terms" className="text-orange-600 hover:text-orange-400">Terms of Service</Link>, <Link href="/privacy" className="text-orange-600 hover:text-orange-400">Privacy Policy</Link>, and <Link href="/ai-policy" className="text-orange-600 hover:text-orange-400">AI Content Policy</Link>.
                  </span>
                </label>
                {signupError && (
                  <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-3">
                    {signupError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={signupBusy}
                  className="w-full bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span>{signupBusy ? 'Creating account...' : 'Create Account'}</span>
                  {signupBusy && <Spinner />}
                </button>
              </form>
            )}

            {/* Post-signup success state */}
            {tab === 'signup' && signupSuccess && (
              <div className="text-center py-4">
                <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-orange-600/15 border border-orange-600/40 flex items-center justify-center">
                  <svg width="24" height="24" fill="none" stroke="#ea580c" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-black text-white mb-2 font-display">Check your inbox</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  We sent a confirmation link to <span className="text-white font-semibold">{signupSuccessEmail}</span>. Click it to finish creating your account.
                </p>
              </div>
            )}

            {/* Trust footer */}
            <div className="mt-6 pt-5 border-t border-zinc-800 flex justify-center gap-6">
              <span className="flex items-center gap-1.5 text-[10px] text-zinc-600 font-bold">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                Secure
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-zinc-600 font-bold">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                Private
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-zinc-600 font-bold">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                Free
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
