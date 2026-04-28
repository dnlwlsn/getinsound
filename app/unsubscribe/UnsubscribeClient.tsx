'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export function UnsubscribeClient() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'done' | 'resubscribed' | 'error'>('loading')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }
    fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: token, unsubscribe: true }),
    })
      .then((r) => {
        setStatus(r.ok ? 'done' : 'error')
      })
      .catch(() => setStatus('error'))
  }, [token])

  async function handleResubscribe() {
    if (!token) return
    const res = await fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: token, unsubscribe: false }),
    })
    setStatus(res.ok ? 'resubscribed' : 'error')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-insound-bg">
      <div className="max-w-md w-full text-center">
        <p className="text-2xl font-black mb-8 text-orange-600 tracking-tight">
          insound.
        </p>

        {status === 'loading' && (
          <p className="text-zinc-400 text-sm">Updating your preferences...</p>
        )}

        {status === 'done' && (
          <>
            <h1 className="text-white text-lg font-bold mb-3">
              You&apos;ve been unsubscribed from Insound emails.
            </h1>
            <p className="text-zinc-500 text-sm mb-8">
              You won&apos;t receive any more broadcast emails from us.
            </p>
            <button
              onClick={handleResubscribe}
              className="text-sm font-bold px-6 py-3 rounded-full border border-orange-600/30 text-orange-600 transition-colors hover:border-orange-600/60"
            >
              Re-subscribe
            </button>
          </>
        )}

        {status === 'resubscribed' && (
          <>
            <h1 className="text-white text-lg font-bold mb-3">
              Welcome back!
            </h1>
            <p className="text-zinc-500 text-sm">
              You&apos;ve been re-subscribed to Insound emails.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-white text-lg font-bold mb-3">
              We couldn&apos;t update your preferences.
            </h1>
            <p className="text-zinc-500 text-sm">
              Check your connection and try again, or contact us if it keeps happening.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
