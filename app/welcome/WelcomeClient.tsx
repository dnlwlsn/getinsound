'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export function WelcomeClient() {
  const supabase = createClient()

  useEffect(() => {
    fetch('/api/referral', { method: 'POST' }).catch(() => {})
  }, [])

  async function markSeen() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('fan_profiles')
        .update({ has_seen_welcome: true })
        .eq('id', user.id)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,109,0,0.05),transparent_60%)]" />

      <div className="w-full max-w-2xl relative z-10 text-center">
        <p className="text-orange-600 font-black text-3xl tracking-tighter font-display mb-6">insound.</p>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[0.92] mb-4">
          You&apos;re in.
        </h1>
        <p className="text-zinc-400 text-lg mb-16 max-w-md mx-auto">
          Start discovering independent music.
        </p>

        <Link
          href="/discover"
          onClick={markSeen}
          className="block max-w-sm mx-auto bg-zinc-900 ring-1 ring-white/[0.06] rounded-3xl p-8 text-center hover:ring-white/[0.15] transition-all group"
        >
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-white/[0.04] flex items-center justify-center">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-zinc-400 group-hover:text-white transition-colors">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <p className="font-display font-bold text-lg mb-2 group-hover:text-white transition-colors">Discover music</p>
          <p className="text-zinc-500 text-sm">Browse, listen, and support artists directly.</p>
        </Link>

        <div className="mt-10 text-center">
          <Link
            href="/become-an-artist"
            onClick={markSeen}
            className="inline-flex items-center gap-2 text-sm text-orange-500 hover:text-orange-400 transition-colors font-semibold"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Are you an artist? Start selling your music
          </Link>
        </div>
      </div>
    </div>
  )
}
