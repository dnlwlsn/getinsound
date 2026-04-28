'use client'

import { useState } from 'react'
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

  async function startOnboarding() {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setError('Not signed in. Please refresh and try again.'); return }

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
      if (data.onboarded) {
        onComplete()
      } else if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('Stripe onboarding error:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
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
