'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export function StripeEmbeddedOnboarding({
  stripeAccountId,
  onComplete,
}: {
  stripeAccountId: string | null
  onComplete: () => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [popupOpen, setPopupOpen] = useState(false)

  // Poll for onboarding completion while popup is open
  useEffect(() => {
    if (!popupOpen) return
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/connect-onboard`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ return_url: `${window.location.origin}/dashboard` }),
          }
        )
        const data = await res.json()
        if (data.onboarded) {
          clearInterval(interval)
          setPopupOpen(false)
          onComplete()
        }
      } catch {}
    }, 3000)
    return () => clearInterval(interval)
  }, [popupOpen, supabase, onComplete])

  const startOnboarding = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setError('Not signed in. Please refresh.'); return }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/connect-onboard`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ return_url: `${window.location.origin}/dashboard` }),
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error || `Failed (${res.status})`)
        return
      }
      const data = await res.json()
      if (data.onboarded) { onComplete(); return }

      if (data.url) {
        const w = 600
        const h = 700
        const left = window.screenX + (window.outerWidth - w) / 2
        const top = window.screenY + (window.outerHeight - h) / 2
        const popup = window.open(
          data.url,
          'stripe-onboarding',
          `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`
        )
        if (popup) {
          setPopupOpen(true)
          const check = setInterval(() => {
            if (popup.closed) {
              clearInterval(check)
              setPopupOpen(false)
            }
          }, 500)
        } else {
          window.location.href = data.url
        }
      }
    } catch (err) {
      console.error('Stripe onboarding error:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [stripeAccountId, supabase, onComplete])

  if (popupOpen) {
    return (
      <div className="mt-4 bg-zinc-800/50 border border-zinc-700 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <div>
            <p className="text-sm font-bold text-zinc-200">Complete your setup in the Stripe window</p>
            <p className="text-xs text-zinc-500 mt-0.5">This page will update automatically when you're done.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-zinc-500 mb-3">
        Set up payouts so you can receive money for your releases. This takes about 2 minutes.
      </p>
      <button
        onClick={startOnboarding}
        disabled={loading}
        className="inline-block bg-orange-600 text-black font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider hover:bg-orange-500 transition-colors disabled:opacity-50"
      >
        {loading ? 'Loading...' : 'Set Up Payouts'}
      </button>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  )
}
