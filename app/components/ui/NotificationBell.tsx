'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NotificationDropdown } from './NotificationDropdown'

interface Props {
  userId: string
  initialUnreadCount?: number
}

export function NotificationBell({ userId, initialUnreadCount = 0 }: Props) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/notifications/unread-count')
      .then(r => r.json())
      .then(d => { if (typeof d.count === 'number') setUnreadCount(d.count) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channelName = `notifications:${userId}:${Date.now()}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => setUnreadCount(prev => prev + 1),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleCloseAll() { setOpen(false) }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('insound:close-dropdowns', handleCloseAll)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('insound:close-dropdowns', handleCloseAll)
    }
  }, [open])

  const handleMarkAllRead = useCallback(() => setUnreadCount(0), [])
  const handleMarkRead = useCallback(() => setUnreadCount(prev => Math.max(0, prev - 1)), [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          if (!open) document.dispatchEvent(new Event('insound:close-dropdowns'))
          setOpen(prev => !prev)
        }}
        className="relative p-2 text-zinc-400 hover:text-white transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-orange-600 text-[10px] font-black text-white px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationDropdown
          onClose={() => setOpen(false)}
          onMarkAllRead={handleMarkAllRead}
          onMarkRead={handleMarkRead}
        />
      )}
    </div>
  )
}
