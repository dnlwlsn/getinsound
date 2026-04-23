'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function AuthClient() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<'password' | 'magic'>('magic')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [magicEmail, setMagicEmail] = useState('')
  const [magicSent, setMagicSent] = useState(false)
  const [magicBusy, setMagicBusy] = useState(false)
  const [magicError, setMagicError] = useState('')

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error
      router.push('/welcome')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.')
      setBusy(false)
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setMagicError('')
    setMagicBusy(true)
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: magicEmail.trim(),
          template: 'signin',
          redirectTo: '/auth/callback?next=/welcome',
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setMagicError(data.error || 'Failed to send magic link.')
      } else {
        setMagicSent(true)
      }
    } catch {
      setMagicError('Something went wrong. Please try again.')
    }
    setMagicBusy(false)
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)', backgroundSize: '48px 48px' }}>
      <nav className="sticky top-0 w-full z-50 flex justify-between items-center px-6 md:px-14 py-5 border-b border-zinc-900/80" style={{ background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <Link href="/" className="text-2xl font-black text-orange-600 tracking-tighter hover:text-orange-500 transition-colors font-display">
          insound.
        </Link>
        <Link href="/signup" className="bg-orange-600 text-black px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition-colors shadow-lg shadow-orange-600/20">
          Create Account
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(234,88,12,0.05),transparent_60%)]" />

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <Link href="/" className="text-3xl font-black text-orange-600 tracking-tighter hover:text-orange-500 transition-colors font-display">
              insound.
            </Link>
            <p className="text-zinc-500 mt-2 font-medium text-sm">Welcome back.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl" style={{ boxShadow: '0 0 60px rgba(234,88,12,0.08)' }}>
            <div className="flex gap-1 mb-8 bg-zinc-950 p-1 rounded-xl">
              <button
                onClick={() => setMode('magic')}
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${mode === 'magic' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Magic Link
              </button>
              <button
                onClick={() => setMode('password')}
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${mode === 'password' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Password
              </button>
            </div>

            {mode === 'magic' && !magicSent && (
              <form onSubmit={handleMagicLink} className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Email Address</label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    required
                    autoComplete="email"
                    value={magicEmail}
                    onChange={e => setMagicEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={magicBusy}
                  className="w-full bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {magicBusy ? 'Sending...' : 'Send magic link →'}
                </button>
                {magicError && (
                  <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-3">
                    {magicError}
                  </div>
                )}
              </form>
            )}

            {mode === 'magic' && magicSent && (
              <div className="text-center py-4">
                <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-orange-600/15 border border-orange-600/40 flex items-center justify-center">
                  <svg width="24" height="24" fill="none" stroke="#ea580c" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-black text-white mb-2 font-display">Check your inbox</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  We sent a magic link to <span className="text-white font-semibold">{magicEmail.trim()}</span>.
                </p>
              </div>
            )}

            {mode === 'password' && (
              <form onSubmit={handlePasswordLogin} className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Email Address</label>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600"
                  />
                </div>
                <div className="relative">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm pr-12 focus:border-orange-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-4 top-[38px] text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      {showPw ? (
                        <>
                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </>
                      ) : (
                        <>
                          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {busy ? 'Signing in...' : 'Sign In'}
                </button>
                {error && (
                  <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-3">
                    {error}
                  </div>
                )}
              </form>
            )}

            <div className="mt-6 pt-5 border-t border-zinc-800 text-center">
              <p className="text-zinc-600 text-xs">
                Don&apos;t have an account? <Link href="/signup" className="text-orange-600 hover:text-orange-400 font-bold">Sign up</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
