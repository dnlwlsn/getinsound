'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function LibrarySignIn() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          template: 'signin',
          redirectTo: '/auth/callback?next=/library',
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to send magic link.')
      } else {
        setSent(true)
      }
    } catch {
      setError('We couldn\'t send your sign-in link - check your connection and try again.')
    }
    setBusy(false)
  }

  return (
    <div className="min-h-screen font-display flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <p className="text-orange-600 text-[10px] font-black uppercase tracking-[0.3em] mb-3">
              Your Collection
            </p>
            <h1 className="text-3xl font-black tracking-tighter mb-2">Sign in to continue</h1>
            <p className="text-zinc-500 text-sm font-medium">
              Your purchased music is waiting for you.
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl">
            {!sent ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {busy ? 'Sending...' : 'Send magic link'}
                </button>
                {error && (
                  <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-3">
                    {error}
                  </div>
                )}
              </form>
            ) : (
              <div className="text-center py-4">
                <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-orange-600/15 border border-orange-600/40 flex items-center justify-center">
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-orange-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-black text-white mb-2">Check your inbox</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  We sent a magic link to{' '}
                  <span className="text-white font-semibold">{email.trim()}</span>.
                </p>
              </div>
            )}

            <div className="mt-6 pt-5 border-t border-zinc-800 text-center">
              <p className="text-zinc-600 text-xs">
                Don&apos;t have an account?{' '}
                <Link href="/auth?mode=signup" className="text-orange-600 hover:text-orange-400 font-bold">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
