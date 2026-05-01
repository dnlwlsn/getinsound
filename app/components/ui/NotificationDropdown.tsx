'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read: boolean
  created_at: string
}

interface Props {
  onClose: () => void
  onMarkAllRead: () => void
  onMarkRead: () => void
}

const TYPE_ICONS: Record<string, string> = {
  sale: '£',
  first_sale: '🎉',
  preorder: '📦',
  merch_order: '👕',
  code_redeemed: '🎟',
  zero_fees_unlocked: '⚡',
  new_release: '💿',
  preorder_ready: '🎵',
  order_dispatched: '📬',
  artist_post: '✏️',
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function NotificationDropdown({ onClose, onMarkAllRead, onMarkRead }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/notifications?page=1')
      .then(r => r.json())
      .then(d => setNotifications(d.notifications ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    onMarkAllRead()
  }

  async function markRead(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    onMarkRead()
  }

  const hasUnread = notifications.some(n => !n.read)

  return (
    <div className="fixed inset-x-3 top-[72px] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-[360px] max-h-[480px] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-[100] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Notifications</p>
        {hasUnread && (
          <button
            onClick={markAllRead}
            className="text-[10px] font-bold text-orange-500 hover:text-orange-400 transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-zinc-700 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 opacity-40">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <p className="text-xs font-bold">No notifications yet</p>
          </div>
        ) : (
          notifications.map(n => {
            const inner = (
              <div
                className={`flex gap-3 px-4 py-3 transition-colors ${
                  n.read ? 'opacity-60' : 'bg-zinc-950/40'
                } ${n.link ? 'hover:bg-zinc-800/60 cursor-pointer' : ''}`}
                onClick={() => { if (!n.read) markRead(n.id) }}
              >
                <span className="text-sm mt-0.5 shrink-0 w-5 text-center">{TYPE_ICONS[n.type] ?? '•'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${n.read ? 'text-zinc-400' : 'text-white font-medium'}`}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{n.body}</p>
                  )}
                  <p className="text-[10px] text-zinc-600 mt-1">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read && (
                  <span className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                )}
              </div>
            )

            return n.link ? (
              <Link key={n.id} href={n.link} onClick={onClose}>
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <Link
        href="/notifications"
        onClick={onClose}
        className="block text-center text-xs font-bold text-orange-500 hover:text-orange-400 py-3 border-t border-zinc-800 transition-colors"
      >
        View all notifications
      </Link>
    </div>
  )
}
