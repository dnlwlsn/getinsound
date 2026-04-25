'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SearchInput } from './SearchInput'
import { ProfileMenu } from './ProfileMenu'
import { NotificationBell } from './NotificationBell'

const NAV_LINKS = [
  { href: '/explore', label: 'Explore' },
  { href: '/discover', label: 'Discover' },
  { href: '/library', label: 'Library' },
]

const HIDE_NAV_ROUTES = ['/', '/signup', '/auth', '/welcome', '/become-an-artist']
const HIDE_NAV_PREFIXES = ['/for-', '/dashboard/settings', '/privacy', '/terms', '/ai-policy', '/why-us', '/redeem']

export function AppNav() {
  const pathname = usePathname()
  const [userId, setUserId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
      setLoaded(true)
    })
  }, [])

  if (!loaded) return null
  if (HIDE_NAV_ROUTES.some(r => pathname === r)) return null
  if (HIDE_NAV_PREFIXES.some(p => pathname.startsWith(p))) return null

  if (!userId) {
    return (
      <nav className="sticky top-0 z-50 w-full">
        <div className="mx-auto max-w-6xl mt-4 rounded-full px-6 py-3 flex items-center justify-between ring-1 ring-white/[0.06]"
          style={{ background: 'rgba(5,5,5,0.75)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
          <Link href="/" className="font-display text-lg font-bold text-orange-500 tracking-tight">
            insound<span className="text-white/25">.</span>
          </Link>
          <Link href="/signup"
            className="bg-orange-600 hover:bg-orange-500 text-black text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-full transition-colors">
            Join the Waitlist
          </Link>
        </div>
      </nav>
    )
  }

  return (
    <nav className="sticky top-0 w-full z-40 border-b border-zinc-900 bg-[rgba(9,9,11,0.88)] backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex justify-between items-center px-5 md:px-10 py-4 gap-3">
        <Link href="/explore" className="text-xl font-black text-orange-600 tracking-tighter flex-shrink-0 hover:text-orange-500 transition-colors">
          insound.
        </Link>

        <SearchInput className="flex-1 max-w-md hidden md:block" />
        <Link href="/search" className="md:hidden p-2 text-zinc-400 hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </Link>

        <div className="flex gap-4 items-center text-xs font-black uppercase tracking-widest">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`hidden sm:block transition-colors ${
                pathname === link.href ? 'text-white' : 'text-zinc-500 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <NotificationBell userId={userId} />
          <ProfileMenu />
        </div>
      </div>
    </nav>
  )
}
