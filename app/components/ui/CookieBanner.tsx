'use client'

import { useState, useEffect } from 'react'

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`
}

export function getConsentLevel(): 'accepted' | 'functional' | 'essential-only' | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(^| )insound_consent=([^;]+)/)
  const val = match ? decodeURIComponent(match[2]) : null
  if (val === 'accepted' || val === 'functional') return val
  if (val === 'essential-only') return val
  return null
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [managing, setManaging] = useState(false)
  const [functionalOn, setFunctionalOn] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const consent = getCookie('insound_consent')
    if (!consent) {
      setVisible(true)
      // Delay mount animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setMounted(true))
      })
    }
  }, [])

  function accept() {
    setCookie('insound_consent', 'accepted', 365)
    setMounted(false)
    setTimeout(() => setVisible(false), 300)
  }

  function save() {
    setCookie('insound_consent', functionalOn ? 'functional' : 'essential-only', 365)
    setMounted(false)
    setTimeout(() => setVisible(false), 300)
  }

  if (!visible) return null

  return (
    <div
      className={`fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-lg
        rounded-xl bg-zinc-900 border border-white/[0.08] p-5 shadow-2xl
        transition-all duration-300 ease-out
        ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
    >
      <p className="text-[13px] leading-relaxed text-zinc-400">
        We use cookies to remember your preferences and improve your experience.{' '}
        <a href="/privacy" className="text-white underline underline-offset-2 hover:text-[#F56D00]">
          Privacy policy
        </a>
      </p>

      {managing && (
        <div className="mt-4 space-y-3">
          {/* Strictly necessary */}
          <label className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-400">
              Strictly necessary cookies
            </span>
            <span className="relative inline-block h-5 w-9 cursor-not-allowed">
              <span className="block h-5 w-9 rounded-full bg-[#F56D00]/60" />
              <span className="absolute left-[18px] top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all" />
            </span>
          </label>

          {/* Functional */}
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-[11px] font-medium text-zinc-400">
              Functional cookies (preferences, currency)
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={functionalOn}
              onClick={() => setFunctionalOn(!functionalOn)}
              className={`relative inline-block h-5 w-9 rounded-full transition-colors ${
                functionalOn ? 'bg-[#F56D00]' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                  functionalOn ? 'left-[18px]' : 'left-0.5'
                }`}
              />
            </button>
          </label>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        {!managing ? (
          <>
            <button
              onClick={accept}
              className="inline-flex items-center justify-center rounded-full bg-[#F56D00] px-5 py-2
                text-[10px] font-black uppercase tracking-widest text-[#09090b]
                hover:brightness-110 active:scale-[0.98] transition-all duration-150"
            >
              Accept
            </button>
            <button
              onClick={() => setManaging(true)}
              className="inline-flex items-center justify-center rounded-full bg-transparent
                ring-1 ring-white/[0.12] px-5 py-2
                text-[10px] font-black uppercase tracking-widest text-white
                hover:ring-white/[0.25] hover:bg-white/[0.04] active:scale-[0.98]
                transition-all duration-150"
            >
              Manage
            </button>
          </>
        ) : (
          <button
            onClick={save}
            className="inline-flex items-center justify-center rounded-full bg-[#F56D00] px-5 py-2
              text-[10px] font-black uppercase tracking-widest text-[#09090b]
              hover:brightness-110 active:scale-[0.98] transition-all duration-150"
          >
            Save preferences
          </button>
        )}
      </div>
    </div>
  )
}
