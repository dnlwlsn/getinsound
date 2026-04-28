'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from '@stripe/react-connect-js'
import { loadConnectAndInitialize } from '@stripe/connect-js'

export function StripeEmbeddedOnboarding({
  stripeAccountId,
  onComplete,
}: {
  stripeAccountId: string | null
  onComplete: () => void
}) {
  const supabase = createClient()
  const [started, setStarted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stripeConnectInstance, setStripeConnectInstance] = useState<ReturnType<typeof loadConnectAndInitialize> | null>(null)

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  async function ensureStripeAccount(token: string) {
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
      throw new Error(err.error || `connect-onboard failed (${res.status})`)
    }
    return res.json()
  }

  const fallbackToRedirect = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      if (!token) { setError('Not signed in.'); return }
      const data = await ensureStripeAccount(token)
      if (data.onboarded) { onComplete(); return }
      if (data.url) { window.location.href = data.url; return }
      setError('Could not get onboarding link.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }, [supabase, onComplete])

  const startOnboarding = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      if (!token) { setError('Not signed in. Please refresh and try again.'); return }

      if (!stripeAccountId) {
        const data = await ensureStripeAccount(token)
        if (data.onboarded) { onComplete(); return }
      }

      const sessionRes = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/connect-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!sessionRes.ok) {
        const err = await sessionRes.json().catch(() => ({}))
        throw new Error(err.error || `connect-session failed (${sessionRes.status})`)
      }

      const { client_secret } = await sessionRes.json()
      if (!client_secret) throw new Error('No client secret returned.')

      const instance = loadConnectAndInitialize({
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
        fetchClientSecret: async () => client_secret,
        appearance: {
          overlays: 'dialog',
          variables: {
            colorPrimary: '#ea580c',
            colorBackground: '#18181b',
            colorText: '#e4e4e7',
            colorSecondaryText: '#71717a',
            colorBorder: '#27272a',
            borderRadius: '12px',
            fontFamily: 'inherit',
          },
        },
      })

      setStripeConnectInstance(instance)
      setStarted(true)
    } catch (err) {
      console.error('Embedded onboarding failed, redirect available:', err)
      setError('Embedded setup failed. You can continue on Stripe instead.')
    } finally {
      setLoading(false)
    }
  }, [stripeAccountId, supabase, onComplete])

  if (!started) {
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
        {error && (
          <div className="mt-3">
            <p className="text-red-400 text-xs">{error}</p>
            {error.includes('redirect') || error.includes('Embedded') ? (
              <button
                onClick={fallbackToRedirect}
                disabled={loading}
                className="mt-2 text-xs text-orange-500 hover:text-orange-400 font-bold transition-colors disabled:opacity-50"
              >
                {loading ? 'Redirecting...' : 'Continue on Stripe instead →'}
              </button>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mt-4">
      {stripeConnectInstance && (
        <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
          <ConnectAccountOnboarding
            onExit={() => onComplete()}
          />
        </ConnectComponentsProvider>
      )}
    </div>
  )
}
