'use client'

import { useState, useEffect } from 'react'

interface Props {
  email: string
  onVerified: () => void
  onClose: () => void
}

export function ReverifyModal({ email, onVerified, onClose }: Props) {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const [error, setError] = useState('')

  async function handleSend() {
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          template: 'reverify',
          redirectTo: '/auth/callback?next=' + encodeURIComponent('/settings/account?reverified=1'),
        }),
      })
      if (!res.ok) {
        setError('Failed to send verification email. Please try again.')
      } else {
        setSent(true)
      }
    } catch {
      setError('Network error. Please check your connection and try again.')
    }
    setSending(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="reverify-title" className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full mx-4">
        <h3 id="reverify-title" className="text-lg font-semibold text-white mb-2">Verify your identity</h3>
        {!sent ? (
          <>
            <p className="text-sm text-zinc-400 mb-6">
              To continue, we need to verify your identity. We&apos;ll send a magic link to{' '}
              <span className="text-white">{email}</span>.
            </p>
            {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send verification'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-400 mb-6">
              Check your email for a verification link. Click it, then come back here to continue.
            </p>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
