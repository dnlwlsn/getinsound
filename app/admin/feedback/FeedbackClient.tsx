'use client'

import { useState } from 'react'
import Link from 'next/link'

interface FeedbackItem {
  id: string
  category: 'bug' | 'feature_request' | 'general'
  message: string
  page_url: string | null
  status: 'new' | 'noted' | 'done' | 'dismissed'
  admin_notes: string | null
  created_at: string
  fan_profiles: { username: string; avatar_url: string | null } | null
}

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Bug Report',
  feature_request: 'Feature Request',
  general: 'General',
}

const CATEGORY_STYLES: Record<string, string> = {
  bug: 'bg-red-500/20 text-red-400',
  feature_request: 'bg-purple-500/20 text-purple-400',
  general: 'bg-blue-500/20 text-blue-400',
}

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-orange-500/20 text-orange-400',
  noted: 'bg-blue-500/20 text-blue-400',
  done: 'bg-green-500/20 text-green-400',
  dismissed: 'bg-zinc-500/20 text-zinc-400',
}

type Filter = 'active' | 'all'

export function FeedbackClient({ initialItems, fetchError }: { initialItems: FeedbackItem[]; fetchError?: string | null }) {
  const [items, setItems] = useState<FeedbackItem[]>(initialItems)
  const [loading] = useState(false)
  const [filter, setFilter] = useState<Filter>('active')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [acting, setActing] = useState(false)

  async function handleAction(id: string, status: 'noted' | 'done' | 'dismissed') {
    setActing(true)
    const res = await fetch(`/api/admin/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_notes: notes.trim() || undefined }),
    })
    if (res.ok) {
      setItems(prev => prev.map(item =>
        item.id === id ? { ...item, status, admin_notes: notes.trim() || item.admin_notes } : item
      ))
      setNotes('')
    }
    setActing(false)
  }

  const filtered = items.filter(item =>
    filter === 'active' ? item.status === 'new' || item.status === 'noted' : true
  )

  const counts = {
    new: items.filter(i => i.status === 'new').length,
    noted: items.filter(i => i.status === 'noted').length,
    total: items.length,
  }

  return (
    <div className="min-h-screen bg-insound-bg text-zinc-100 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">&larr; Admin</Link>
            <h1 className="text-2xl font-display font-bold tracking-tight mt-1">User Feedback</h1>
          </div>
          <div className="flex gap-2 text-xs">
            {counts.new > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-400 font-bold">
                {counts.new} new
              </span>
            )}
            {counts.noted > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 font-bold">
                {counts.noted} noted
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {(['active', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filter === f ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f === 'active' ? 'Active' : 'All'} ({f === 'active' ? counts.new + counts.noted : counts.total})
            </button>
          ))}
        </div>

        {fetchError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3 mb-4">
            <p className="text-sm font-bold text-red-400">Failed to load feedback</p>
            <p className="text-xs text-red-400/70 mt-1 font-mono">{fetchError}</p>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : filtered.length === 0 && !fetchError ? (
          <div className="text-center py-16 text-zinc-500">
            <p className="text-sm">No feedback yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const expanded = expandedId === item.id
              return (
                <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => { setExpandedId(expanded ? null : item.id); setNotes(item.admin_notes || '') }}
                    className="w-full text-left p-4 hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${CATEGORY_STYLES[item.category]}`}>
                            {CATEGORY_LABELS[item.category]}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[item.status]}`}>
                            {item.status}
                          </span>
                          {item.page_url && (
                            <span className="text-[10px] text-zinc-600 font-mono">{item.page_url}</span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-200 line-clamp-2">{item.message}</p>
                        <div className="flex items-center gap-2 mt-2 text-[11px] text-zinc-500">
                          <span>{item.fan_profiles?.username ? `@${item.fan_profiles.username}` : 'Anonymous'}</span>
                          <span>·</span>
                          <span>{new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </div>
                      <span className="text-zinc-600 text-xs mt-1">{expanded ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-zinc-800 p-4 space-y-3">
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap">{item.message}</p>

                      <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Admin notes (optional)..."
                        rows={2}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 resize-none focus:outline-none focus:border-zinc-500"
                      />

                      <div className="flex gap-2">
                        {item.status !== 'noted' && (
                          <button
                            onClick={() => handleAction(item.id, 'noted')}
                            disabled={acting}
                            className="px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 text-xs font-bold hover:bg-blue-600/30 disabled:opacity-40 transition-colors"
                          >
                            Note
                          </button>
                        )}
                        {item.status !== 'done' && (
                          <button
                            onClick={() => handleAction(item.id, 'done')}
                            disabled={acting}
                            className="px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 text-xs font-bold hover:bg-green-600/30 disabled:opacity-40 transition-colors"
                          >
                            Done
                          </button>
                        )}
                        {item.status !== 'dismissed' && (
                          <button
                            onClick={() => handleAction(item.id, 'dismissed')}
                            disabled={acting}
                            className="px-3 py-1.5 rounded-lg bg-zinc-600/20 text-zinc-400 text-xs font-bold hover:bg-zinc-600/30 disabled:opacity-40 transition-colors"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
