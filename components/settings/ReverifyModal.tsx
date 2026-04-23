'use client'

import { useState } from 'react'

interface Props {
  email: string
  onVerified: () => void
  onClose: () => void
}

export function ReverifyModal({ email, onVerified, onClose }: Props) {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  async function handleSend() {
    setSending(true)
    await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        template: 'reverify',
        redirectTo: '/auth/callback?next=/settings/account?reverified=1',
      }),
    })
    setSent(true)
    setSending(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-white mb-2">Verify your identity</h3>
        {!sent ? (
          <>
            <p className="text-sm text-zinc-400 mb-6">
              To continue, we need to verify your identity. We&apos;ll send a magic link to{' '}
              <span className="text-white">{email}</span>.
            </p>
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
