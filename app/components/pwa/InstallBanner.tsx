'use client'

import { useState, useEffect, useRef } from 'react'
import { isIOS, isStandalone } from '@/lib/pwa/ios'
import {
  incrementVisitCount,
  isInstallDismissed,
  dismissInstall,
} from '@/lib/pwa/install-prompt'

export function InstallBanner() {
  const [show, setShow] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const deferredPrompt = useRef<any>(null)

  useEffect(() => {
    if (isStandalone()) return

    const count = incrementVisitCount()
    const shouldShow = count >= 2 && !isInstallDismissed()

    if (!shouldShow) return

    if (isIOS()) {
      setShow(true)
      setShowIOSInstructions(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e
      setShow(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!show) return null

  async function handleInstall() {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt()
      const result = await deferredPrompt.current.userChoice
      if (result.outcome === 'accepted') {
        setShow(false)
      }
      deferredPrompt.current = null
    }
  }

  function handleDismiss() {
    dismissInstall()
    setShow(false)
  }

  return (
    <div className="fixed left-0 right-0 z-[60] px-4 animate-in slide-in-from-bottom-4 sm:bottom-24" style={{ bottom: 'calc(var(--player-bar-height) + env(safe-area-inset-bottom) + 68px)' }}>
      <div className="max-w-screen-xl mx-auto">
        <div className="bg-zinc-900 border border-white/[0.08] rounded-2xl p-4 flex items-center gap-4 shadow-2xl">
          {/* Waveform icon */}
          <div className="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center flex-shrink-0 border border-white/[0.06]">
            <svg width="24" height="24" viewBox="0 0 143 120" aria-hidden="true">
              <rect x="0" y="39.168" width="18" height="41.664" rx="3" fill="#F47429" />
              <rect x="25" y="27.648" width="18" height="64.704" rx="3" fill="#F47429" />
              <rect x="50" y="16.128" width="18" height="87.744" rx="3" fill="#F47429" />
              <rect x="75" y="25.344" width="18" height="69.312" rx="3" fill="#F47429" />
              <rect x="100" y="11.52" width="18" height="96.96" rx="3" fill="#F47429" />
              <rect x="125" y="27.648" width="18" height="64.704" rx="3" fill="#F47429" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">
              Add Insound to your home screen
            </p>
            {showIOSInstructions ? (
              <p className="text-xs text-zinc-400 mt-0.5">
                Tap{' '}
                <svg className="inline w-3.5 h-3.5 -mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V10c0-1.1.9-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .9 2 2z" />
                </svg>
                {' '}then &quot;Add to Home Screen&quot;
              </p>
            ) : (
              <p className="text-xs text-zinc-400 mt-0.5">
                Quick access to your music, anytime
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!showIOSInstructions && (
              <button
                onClick={handleInstall}
                className="px-4 py-2 text-sm font-bold rounded-xl bg-orange-600 text-white hover:bg-orange-500 transition-colors"
              >
                Install
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="p-2 text-zinc-500 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
