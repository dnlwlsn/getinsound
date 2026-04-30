'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useScrollDirection } from '@/lib/hooks/useScrollDirection'
import { SearchInput } from './SearchInput'
import { ProfileMenu } from './ProfileMenu'
import { NotificationBell } from './NotificationBell'
import { BasketButton } from './BasketButton'
import { InsoundLogo } from './InsoundLogo'

const NAV_LINKS = [
  { href: '/explore', label: 'Explore' },
  { href: '/discover', label: 'For You' },
  { href: '/library', label: 'My Collection' },
]

const LOGGED_OUT_MENU_LINKS = [
  { href: '/for-artists', label: 'For Artists' },
  { href: '/for-fans', label: 'For Fans' },
  { href: '/faq', label: 'FAQ' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/ai-policy', label: 'AI Policy' },
]

const LOGGED_IN_MENU_LINKS = [
  { href: '/settings', label: 'Settings' },
  { href: '/orders', label: 'Orders' },
  { href: '/for-artists', label: 'For Artists' },
  { href: '/faq', label: 'FAQ' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
]

const HIDE_NAV_ROUTES = ['/signup', '/auth', '/welcome', '/become-an-artist']
const HIDE_NAV_PREFIXES = ['/for-', '/why-us', '/redeem']

function HamburgerMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
        aria-label="Menu"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed right-4 top-16 w-52 max-h-[calc(100dvh-80px)] overflow-y-auto bg-zinc-950 ring-1 ring-white/[0.08] rounded-2xl shadow-2xl py-2 z-50">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-white/[0.06] my-1" />
            <span className="block px-5 py-2 text-[10px] text-zinc-700 font-medium">&copy; 2026 Insound</span>
          </div>
        </>
      )}
    </div>
  )
}

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

  const navHidden = useScrollDirection()

  if (!loaded) {
    return (
      <>
        <nav className="fixed top-0 z-50 w-full pt-4 px-4" style={{ background: 'transparent' }}>
          <div className="mx-auto max-w-7xl rounded-full px-6 py-3 flex items-center justify-between ring-1 ring-white/[0.06]"
            style={{ background: 'rgba(5,5,5,0.75)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
            <InsoundLogo size="sm" />
            <div className="w-20" />
          </div>
        </nav>
        <div className="h-[72px]" />
      </>
    )
  }
  if (HIDE_NAV_ROUTES.some(r => pathname === r)) return null
  if (HIDE_NAV_PREFIXES.some(p => pathname.startsWith(p))) return null

  if (!userId) {
    return (
      <>
      <nav className={`fixed top-0 z-50 w-full pt-4 px-4 transition-transform duration-300 ${navHidden ? '-translate-y-full' : 'translate-y-0'}`} style={{ background: 'transparent' }}>
        <div className="mx-auto max-w-7xl rounded-full px-6 py-3 flex items-center justify-between ring-1 ring-white/[0.06]"
          style={{ background: 'rgba(5,5,5,0.75)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
          <InsoundLogo size="sm" />
          <div className="flex items-center gap-2">
            <Link href="/search" className="p-2 text-zinc-400 hover:text-white transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </Link>
            <Link href="/for-fans" className="text-zinc-400 hover:text-white text-[11px] font-bold uppercase tracking-widest px-3 py-2.5 transition-colors whitespace-nowrap hidden sm:block">
              How It Works
            </Link>
            <BasketButton />
            <Link href="/auth"
              className="text-zinc-400 hover:text-white text-[11px] font-bold uppercase tracking-widest px-3 sm:px-4 py-2.5 transition-colors whitespace-nowrap">
              Sign In
            </Link>
            <Link href="/signup"
              className="bg-orange-600 hover:bg-orange-500 text-black text-[11px] font-bold uppercase tracking-widest px-3 sm:px-5 py-2.5 rounded-full transition-colors whitespace-nowrap">
              Sign Up
            </Link>
            <HamburgerMenu links={LOGGED_OUT_MENU_LINKS} />
          </div>
        </div>
      </nav>
      <div className="h-[72px]" />
      </>
    )
  }

  return (
    <>
      <div className="h-[72px]" />
      <nav className={`fixed top-0 w-full z-40 border-b border-zinc-900 bg-[rgba(9,9,11,0.88)] backdrop-blur-xl transition-transform duration-300 ${navHidden ? '-translate-y-full' : 'translate-y-0'}`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center px-5 md:px-10 py-4 gap-3">
          <InsoundLogo size="md" className="flex-shrink-0 leading-none" />

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
            <BasketButton />
            <ProfileMenu />
            <HamburgerMenu links={LOGGED_IN_MENU_LINKS} />
          </div>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 border-t border-zinc-900 backdrop-blur-xl flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV_LINKS.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              pathname === link.href ? 'text-orange-500' : 'text-zinc-500'
            }`}
          >
            {link.href === '/explore' && (
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            )}
            {link.href === '/discover' && (
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
            )}
            {link.href === '/library' && (
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/></svg>
            )}
            <span className="text-[10px] font-black uppercase tracking-wider">{link.label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
