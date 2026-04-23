'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export function SignupClient() {
  const searchParams = useSearchParams()
  const intent = searchParams.get('intent')
  const authError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<'form' | 'sent' | 'error'>('form')
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return

    setSending(true)
    setErrorMsg('')

    const redirectPath = intent === 'artist' ? '/become-an-artist' : '/welcome'

    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          template: 'signin',
          redirectTo: `/auth/callback?next=${redirectPath}`,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setErrorMsg(data.error || 'Failed to send magic link.')
        setPhase('error')
      } else {
        setPhase('sent')
      }
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setPhase('error')
    }
    setSending(false)
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)', backgroundSize: '48px 48px' }}>
      <nav className="sticky top-0 w-full z-50 flex justify-between items-center px-6 md:px-14 py-5 border-b border-zinc-900/80" style={{ background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <Link href="/" className="text-2xl font-black text-orange-600 tracking-tighter hover:text-orange-500 transition-colors font-display">
          insound.
        </Link>
        <div className="flex gap-3 items-center">
          <Link href="/auth" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">Sign In</Link>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(234,88,12,0.05),transparent_60%)]" />

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <Link href="/" className="text-3xl font-black text-orange-600 tracking-tighter hover:text-orange-500 transition-colors font-display">
              insound.
            </Link>
            <p className="text-zinc-500 mt-2 font-medium text-sm">
              {intent === 'artist' ? 'Start selling your music.' : 'Independent music, directly supported.'}
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl" style={{ boxShadow: '0 0 60px rgba(234,88,12,0.08)' }}>

            {phase === 'form' && (
              <>
                <h2 className="font-display text-xl font-bold text-center mb-2">Join Insound</h2>
                <p className="text-zinc-500 text-sm text-center mb-8">We&apos;ll send you a magic link to sign in.</p>

                {authError && (
                  <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-3 mb-5">
                    Something went wrong. Please try again.
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Email Address</label>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {sending ? 'Sending...' : 'Continue with email →'}
                  </button>
                </form>

                <p className="text-center text-zinc-600 text-xs mt-6">
                  Already have an account? <Link href="/auth" className="text-orange-600 hover:text-orange-400">Sign in</Link>
                </p>
              </>
            )}

            {phase === 'sent' && (
              <div className="text-center py-4">
                <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-orange-600/15 border border-orange-600/40 flex items-center justify-center">
                  <svg width="24" height="24" fill="none" stroke="#ea580c" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-black text-white mb-2 font-display">Check your inbox</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  We sent a magic link to <span className="text-white font-semibold">{email.trim()}</span>. Click it to sign in.
                </p>
              </div>
            )}

            {phase === 'error' && (
              <div className="text-center py-4">
                <p className="text-red-400 text-sm mb-4">{errorMsg}</p>
                <button onClick={() => setPhase('form')} className="text-orange-600 hover:text-orange-400 text-sm font-bold">
                  Try again
                </button>
              </div>
            )}

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

          <p className="text-zinc-700 text-xs text-center mt-6 font-medium">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="hover:text-zinc-500 transition-colors">Terms</Link>,{' '}
            <Link href="/privacy" className="hover:text-zinc-500 transition-colors">Privacy Policy</Link>, and{' '}
            <Link href="/ai-policy" className="hover:text-zinc-500 transition-colors">AI Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
