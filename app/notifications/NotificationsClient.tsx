'use client'

import { useState, useEffect, useCallback } from 'react'
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

type Filter = 'all' | 'unread' | 'read'

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

function formatDate(date: string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  userId: string
}

export function NotificationsClient({ userId }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const fetchNotifications = useCallback(async (p: number, f: Filter) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p) })
      if (f !== 'all') params.set('filter', f)
      const res = await fetch(`/api/notifications?${params}`)
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setTotal(data.total ?? 0)
      setPageSize(data.pageSize ?? 20)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchNotifications(page, filter) }, [page, filter, fetchNotifications])

  async function markRead(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const totalPages = Math.ceil(total / pageSize)
  const hasUnread = notifications.some(n => !n.read)

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-2xl font-bold">Notifications</h1>
          {hasUnread && (
            <button
              onClick={markAllRead}
              className="text-xs font-bold text-orange-500 hover:text-orange-400 transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-4 border-b border-zinc-800 mb-6">
          {(['all', 'unread', 'read'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1) }}
              className={`pb-3 text-sm font-bold capitalize transition-colors ${
                filter === f
                  ? 'text-orange-500 border-b-2 border-orange-500'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-40">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <p className="text-sm font-bold">
              {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map(n => {
              const inner = (
                <div
                  className={`flex gap-4 px-4 py-4 rounded-xl transition-colors ${
                    n.read ? 'opacity-60' : 'bg-zinc-900/60'
                  } ${n.link ? 'hover:bg-zinc-800/60 cursor-pointer' : ''}`}
                  onClick={() => { if (!n.read) markRead(n.id) }}
                >
                  <span className="text-base mt-0.5 shrink-0 w-6 text-center">{TYPE_ICONS[n.type] ?? '•'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${n.read ? 'text-zinc-400' : 'text-white font-medium'}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-zinc-500 mt-1">{n.body}</p>
                    )}
                    <p className="text-[10px] text-zinc-600 mt-1.5">{formatDate(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-orange-500 mt-2 shrink-0" />
                  )}
                </div>
              )

              return n.link ? (
                <Link key={n.id} href={n.link}>{inner}</Link>
              ) : (
                <div key={n.id}>{inner}</div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page <= 1}
              className="text-xs font-bold text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>
            <span className="text-xs text-zinc-600">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages}
              className="text-xs font-bold text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        )}

        {/* Settings link */}
        <div className="mt-12 text-center">
          <Link
            href="/settings/account"
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Manage notification preferences →
          </Link>
        </div>
      </div>
    </div>
  )
}
