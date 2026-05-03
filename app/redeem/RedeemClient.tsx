'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

interface ReleaseInfo {
  title: string
  cover_url: string | null
  type: string
  artist_name: string
  artist_slug: string
}

type Phase = 'code' | 'release' | 'submitting' | 'done' | 'error'

export function RedeemClient() {
  const searchParams = useSearchParams()
  const initialCode = searchParams.get('code') || ''

  const [code, setCode] = useState(initialCode)
  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<Phase>('code')
  const [release, setRelease] = useState<ReleaseInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleValidate(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return

    setLoading(true)
    setErrorMsg('')

    try {
      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed, action: 'validate' }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'Invalid code.')
        setPhase('error')
      } else {
        setRelease(data.release)
        setPhase('release')
      }
    } catch {
      setErrorMsg('We couldn\'t verify that code - check your connection and try again.')
      setPhase('error')
    }
    setLoading(false)
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail) return

    setPhase('submitting')
    setErrorMsg('')

    try {
      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), email: trimmedEmail, action: 'redeem' }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'Redemption failed.')
        setPhase('error')
      } else {
        setPhase('done')
      }
    } catch {
      setErrorMsg('Redemption failed - check your connection and try again.')
      setPhase('error')
    }
  }

  function handleReset() {
    setPhase('code')
    setErrorMsg('')
    setCode('')
    setEmail('')
    setRelease(null)
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,109,0,0.05),transparent_60%)]" />

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <Link href="/" className="text-3xl font-black text-orange-600 tracking-tighter hover:text-orange-500 transition-colors font-display">
              insound.
            </Link>
            <p className="text-zinc-500 mt-2 font-medium text-sm">
              Redeem a download code
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl" style={{ boxShadow: '0 0 60px rgba(245,109,0,0.08)' }}>

            {phase === 'code' && (
              <>
                <h2 className="font-display text-xl font-bold text-center mb-2">Enter your code</h2>
                <p className="text-zinc-500 text-sm text-center mb-8">Paste the download code you received from the artist.</p>

                <form onSubmit={handleValidate} className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Download Code</label>
                    <input
                      type="text"
                      placeholder="INSND-XXXX-XXXX"
                      required
                      autoComplete="off"
                      autoFocus
                      value={code}
                      onChange={e => setCode(e.target.value.toUpperCase())}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600 font-mono tracking-wider"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Checking...' : 'Redeem code →'}
                  </button>
                </form>
              </>
            )}

            {phase === 'release' && release && (
              <>
                <div className="flex items-center gap-4 mb-6">
                  {release.cover_url ? (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-zinc-800 shrink-0">
                      <Image
                        src={release.cover_url}
                        alt={release.title}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                      <svg width="24" height="24" fill="none" stroke="#71717a" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-0.5">{release.type}</p>
                    <h3 className="text-white font-bold text-lg truncate font-display">{release.title}</h3>
                    <p className="text-zinc-400 text-sm">{release.artist_name}</p>
                  </div>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 mb-6">
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Enter your email to claim this release. We&apos;ll add it to your collection and send you a magic link to access it.
                  </p>
                </div>

                <form onSubmit={handleRedeem} className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Email Address</label>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      required
                      autoComplete="email"
                      autoFocus
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Claim release →
                  </button>
                </form>

                <button
                  onClick={handleReset}
                  className="w-full text-center text-zinc-600 text-xs mt-4 hover:text-zinc-400 transition-colors"
                >
                  Use a different code
                </button>
              </>
            )}

            {phase === 'submitting' && (
              <div className="text-center py-8">
                <div className="inline-block w-12 h-12 border-4 border-zinc-800 border-t-orange-600 rounded-full animate-spin mb-6" />
                <p className="text-zinc-400 text-sm">Redeeming your code...</p>
              </div>
            )}

            {phase === 'done' && (
              <div className="text-center py-4">
                <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-orange-600/15 border border-orange-600/40 flex items-center justify-center">
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-orange-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-black text-white mb-2 font-display">You&apos;re all set!</h3>
                <p className="text-sm text-zinc-400 leading-relaxed mb-1">
                  The release has been added to your collection.
                </p>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Check your inbox for a magic link to <span className="text-white font-semibold">{email.trim()}</span> to access it.
                </p>
                <div className="flex flex-col gap-3 mt-6">
                  <Link
                    href="/library"
                    className="w-full bg-orange-600 text-black font-black py-3 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider text-center"
                  >
                    Go to My Collection
                  </Link>
                  <Link
                    href="/explore"
                    className="w-full text-center text-sm text-zinc-400 hover:text-white transition-colors font-bold"
                  >
                    Explore more music
                  </Link>
                </div>
              </div>
            )}

            {phase === 'error' && (
              <div className="text-center py-4">
                <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-red-600/15 border border-red-600/40 flex items-center justify-center">
                  <svg width="24" height="24" fill="none" stroke="#dc2626" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-red-400 text-sm mb-4">{errorMsg}</p>
                <button onClick={handleReset} className="text-orange-600 hover:text-orange-400 text-sm font-bold">
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
