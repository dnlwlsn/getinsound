'use client'

import { useState, useEffect } from 'react'

interface Props {
  isLoggedIn: boolean
  userEmail: string | null
}

export function NewsletterSignup({ isLoggedIn, userEmail }: Props) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (sessionStorage.getItem('newsletter-subscribed')) {
      setStatus('success')
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const submitEmail = isLoggedIn ? userEmail : email.trim()
    if (!submitEmail) return

    setStatus('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: submitEmail }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setErrorMsg(data.error || 'Something went wrong')
        return
      }
      setStatus('success')
      sessionStorage.setItem('newsletter-subscribed', '1')
    } catch {
      setStatus('error')
      setErrorMsg('Something went wrong')
    }
  }

  return (
    <section className="border-t border-zinc-900">
      <div className="max-w-7xl mx-auto px-5 md:px-10 py-16 text-center">
        <h2 className="font-display text-lg font-bold text-white mb-1">Stay in the loop</h2>
        <p className="text-sm text-zinc-500 mb-8">
          New releases, artist spotlights, and platform updates. Weekly.
        </p>

        {status === 'success' ? (
          <p className="text-orange-500 font-bold text-sm">You&apos;re in!</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-md mx-auto">
            {isLoggedIn ? (
              <span className="flex-1 text-sm text-zinc-400 flex items-center justify-end pr-2">
                {userEmail}
              </span>
            ) : (
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 bg-zinc-900 ring-1 ring-white/[0.06] rounded-full px-5 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-orange-600/40"
              />
            )}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-black text-[11px] font-bold uppercase tracking-widest px-6 py-3 rounded-full transition-colors"
            >
              {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
            </button>
          </form>
        )}

        {status === 'error' && (
          <p className="text-red-400 text-xs mt-3">{errorMsg}</p>
        )}
      </div>
    </section>
  )
}
