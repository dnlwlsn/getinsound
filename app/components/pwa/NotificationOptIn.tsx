'use client'

import { useState, useEffect } from 'react'
import { subscribeToPush } from '@/lib/pwa/push'
import { supportsWebPush } from '@/lib/pwa/ios'
import { isNotifOptInDismissed, dismissNotifOptIn } from '@/lib/pwa/install-prompt'

interface Props {
  show: boolean
}

export function NotificationOptIn({ show }: Props) {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (show && supportsWebPush() && !isNotifOptInDismissed()) {
      setVisible(true)
    }
  }, [show])

  if (!visible) return null

  async function handleAccept() {
    setLoading(true)
    await subscribeToPush()
    dismissNotifOptIn()
    setVisible(false)
  }

  function handleDismiss() {
    dismissNotifOptIn()
    setVisible(false)
  }

  return (
    <div className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-zinc-900 border border-white/[0.08] rounded-2xl p-4 shadow-2xl">
        <p className="text-sm font-semibold text-white">
          Get notified when artists you support release new music?
        </p>
        <p className="text-xs text-zinc-400 mt-1">
          We&apos;ll only notify you about new releases and order updates.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleAccept}
            disabled={loading}
            className="flex-1 py-2 text-sm font-bold rounded-xl bg-orange-600 text-white hover:bg-orange-500 transition-colors disabled:opacity-50"
          >
            {loading ? 'Enabling...' : 'Yes, notify me'}
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
