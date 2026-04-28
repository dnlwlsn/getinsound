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

  const startOnboarding = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!stripeAccountId) {
        const onboardRes = await fetch(
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
        const onboardData = await onboardRes.json()
        if (onboardData.onboarded) {
          onComplete()
          return
        }
      }

      const instance = loadConnectAndInitialize({
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
        fetchClientSecret: async () => {
          const { data: { session: freshSession } } = await supabase.auth.getSession()
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/connect-session`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${freshSession?.access_token}`,
              },
            }
          )
          const data = await res.json()
          if (data.error) throw new Error(data.error)
          return data.client_secret
        },
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
      console.error('Stripe embedded onboarding error:', err)
      setError('Failed to start onboarding. Please try again.')
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
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
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
