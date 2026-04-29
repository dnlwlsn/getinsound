'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { InsoundLogo } from '@/app/components/ui/InsoundLogo'
import { createClient } from '@/lib/supabase/client'

export default function AuthTransferPage() {
  const searchParams = useSearchParams()
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/welcome'
  const [status, setStatus] = useState<'checking' | 'browser-ok' | 'pwa-prompt' | 'transferring' | 'done' | 'error'>('checking')
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true

    if (isStandalone) {
      if (code) {
        exchangeCode(code)
      } else {
        setStatus('error')
      }
    } else {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          window.location.href = next
        } else {
          setStatus('error')
        }
      })
    }
  }, [code])

  async function exchangeCode(transferCode: string) {
    setStatus('transferring')
    try {
      const res = await fetch('/api/auth/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: transferCode }),
      })
      if (!res.ok) {
        setStatus('error')
        return
      }
      const { token_hash } = await res.json()

      const supabase = createClient()
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: 'magiclink',
      })

      if (error) {
        setStatus('error')
        return
      }

      setStatus('done')
      window.location.href = next
    } catch {
      setStatus('error')
    }
  }

  function handleOpenInApp() {
    const appUrl = `${window.location.origin}/auth/transfer?code=${code}&next=${encodeURIComponent(next)}`
    window.location.href = appUrl
    setTimeout(() => setStatus('pwa-prompt'), 500)
  }

  return (
    <div className="min-h-screen bg-insound-bg text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <InsoundLogo size="xl" className="inline-block mb-8" />

        {(status === 'checking' || status === 'transferring') && (
          <div className="space-y-4">
            <div className="w-8 h-8 mx-auto border-2 border-zinc-700 border-t-orange-500 rounded-full animate-spin" />
            <p className="text-sm text-zinc-400">Signing you in...</p>
          </div>
        )}

        {status === 'browser-ok' && (
          <div className="space-y-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-green-500/15 border border-green-500/40 flex items-center justify-center">
              <svg width="24" height="24" fill="none" stroke="#22c55e" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold mb-2">You&apos;re signed in</h1>
              <p className="text-sm text-zinc-400">Redirecting you now...</p>
            </div>
            <a
              href={next}
              className="w-full bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider block text-center"
            >
              Continue
            </a>
          </div>
        )}

        {status === 'pwa-prompt' && (
          <div className="space-y-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-orange-500/15 border border-orange-500/40 flex items-center justify-center">
              <svg width="24" height="24" fill="none" stroke="#f97316" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold mb-2">Open the Insound app</h1>
              <p className="text-sm text-zinc-400">
                If the app didn&apos;t open automatically, tap the Insound icon on your home screen. You&apos;ll be signed in automatically.
              </p>
            </div>
            <a
              href={next}
              className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors mt-4"
            >
              Continue in browser instead
            </a>
          </div>
        )}

        {status === 'done' && (
          <div className="space-y-4">
            <div className="w-8 h-8 mx-auto border-2 border-zinc-700 border-t-orange-500 rounded-full animate-spin" />
            <p className="text-sm text-zinc-400">Redirecting...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-red-500/15 border border-red-500/40 flex items-center justify-center">
              <svg width="24" height="24" fill="none" stroke="#ef4444" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" d="M12 8v4m0 4h.01" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold mb-2">Sign-in link expired</h1>
              <p className="text-sm text-zinc-400">This link has expired or has already been used. Please request a new one.</p>
            </div>
            <a
              href="/auth"
              className="inline-block w-full bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider text-center"
            >
              Sign in again
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
