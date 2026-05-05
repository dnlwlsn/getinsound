'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const HIDE_NAV_ROUTES = ['/signup', '/auth', '/welcome', '/become-an-artist']
const HIDE_NAV_PREFIXES = ['/for-', '/why-us', '/redeem']

export function VerificationBanner() {
  const pathname = usePathname()
  const isHiddenRoute = HIDE_NAV_ROUTES.some(r => pathname === r) || HIDE_NAV_PREFIXES.some(p => pathname.startsWith(p))
  const [show, setShow] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (isHiddenRoute) return
    const dismissed = sessionStorage.getItem('insound_verification_dismissed')
    if (dismissed) return

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      if (user.email_confirmed_at) return
      setEmail(user.email ?? '')
      setShow(true)
    })
  }, [])

  async function handleResend() {
    if (sending || !email) return
    setSending(true)
    try {
      await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          template: 'reverify',
          redirectTo: '/auth/callback?next=' + encodeURIComponent(window.location.pathname),
        }),
      })
      setSent(true)
    } catch {}
    setSending(false)
  }

  function dismiss() {
    sessionStorage.setItem('insound_verification_dismissed', '1')
    setShow(false)
  }

  if (!show || isHiddenRoute) return null

  return (
    <div className="bg-orange-600/10 border-b border-orange-600/20 px-4 py-2.5 flex items-center justify-center gap-3 text-sm relative">
      <span className="text-orange-400 text-xs sm:text-sm">
        Verify your email to unlock purchases and more.
      </span>
      <button
        onClick={handleResend}
        disabled={sending || sent}
        className="text-orange-600 hover:text-orange-400 font-bold text-xs sm:text-sm whitespace-nowrap disabled:opacity-60"
      >
        {sent ? 'Sent!' : sending ? 'Sending...' : 'Resend verification email'}
      </button>
      <button
        onClick={dismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-600/50 hover:text-orange-400 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
