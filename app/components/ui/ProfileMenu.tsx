'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface UserProfile {
  isArtist: boolean
  artistSlug: string | null
  fanUsername: string | null
}

export function ProfileMenu() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const [{ data: artist }, { data: fan }] = await Promise.all([
        supabase.from('artists').select('slug').eq('id', user.id).maybeSingle(),
        supabase.from('fan_profiles').select('username').eq('id', user.id).maybeSingle(),
      ])
      setProfile({
        isArtist: !!artist,
        artistSlug: artist?.slug ?? null,
        fanUsername: fan?.username ?? null,
      })
    })
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node) && menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleCloseAll() { setOpen(false) }
    function handleEscape(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }
    document.addEventListener('insound:close-dropdowns', handleCloseAll)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('insound:close-dropdowns', handleCloseAll)
    }
  }, [open])

  const handleSignOut = useCallback(async () => {
    const { usePlayerStore } = await import('@/lib/stores/player')
    usePlayerStore.getState().stop()
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }, [])

  if (profile === null) {
    return (
      <div className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700 animate-pulse flex-shrink-0" />
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          if (!open) document.dispatchEvent(new Event('insound:close-dropdowns'))
          setOpen(prev => !prev)
        }}
        className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden hover:border-orange-600 transition-colors flex-shrink-0"
        aria-label="Profile menu"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 m-auto text-zinc-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      </button>

      {open && createPortal(
        <div ref={menuRef} className="fixed right-4 top-[72px] w-56 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl py-1.5 z-[60]">
          {profile.isArtist ? (
            <>
              {profile.fanUsername && (
                <MenuLink href={`/@${profile.fanUsername}`} onClick={() => setOpen(false)}>View profile</MenuLink>
              )}
              <MenuLink href="/dashboard" onClick={() => setOpen(false)}>Artist dashboard</MenuLink>
              <MenuLink href="/settings" onClick={() => setOpen(false)}>Settings</MenuLink>
              <MenuLink href="/library" onClick={() => setOpen(false)}>Your collection</MenuLink>
            </>
          ) : (
            <>
              {profile.fanUsername && (
                <MenuLink href={`/@${profile.fanUsername}`} onClick={() => setOpen(false)}>View profile</MenuLink>
              )}
              <MenuLink href="/settings" onClick={() => setOpen(false)}>Settings</MenuLink>
              <MenuLink href="/library" onClick={() => setOpen(false)}>Your collection</MenuLink>
              <div className="mx-1.5 my-1 border-t border-zinc-800" />
              <MenuLink href="/become-an-artist" onClick={() => setOpen(false)} highlight>
                Start selling your music
                <span className="ml-auto text-[9px] font-black uppercase tracking-widest bg-orange-600/15 text-orange-500 px-2 py-0.5 rounded-full ring-1 ring-orange-600/20">
                  New
                </span>
              </MenuLink>
            </>
          )}
          <div className="mx-1.5 my-1 border-t border-zinc-800" />
          <MenuLink href="/faq" onClick={() => setOpen(false)} muted>FAQ</MenuLink>
          <MenuLink href="/privacy" onClick={() => setOpen(false)} muted>Privacy</MenuLink>
          <MenuLink href="/terms" onClick={() => setOpen(false)} muted>Terms</MenuLink>
          <MenuLink href="/ai-policy" onClick={() => setOpen(false)} muted>AI Policy</MenuLink>
          <div className="mx-1.5 my-1 border-t border-zinc-800" />
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2.5 text-sm text-zinc-500 hover:text-red-400 hover:bg-white/[0.03] transition-colors"
          >
            Sign out
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}

function MenuLink({
  href,
  onClick,
  children,
  external,
  highlight,
  muted,
}: {
  href: string
  onClick: () => void
  children: React.ReactNode
  external?: boolean
  highlight?: boolean
  muted?: boolean
}) {
  const className = highlight
    ? 'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-orange-500 hover:bg-orange-600/[0.06] transition-colors'
    : muted
      ? 'flex items-center gap-2 px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] transition-colors'
      : 'flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-white/[0.03] transition-colors'

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
        {children}
        <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="ml-auto text-zinc-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
        </svg>
      </a>
    )
  }

  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  )
}
