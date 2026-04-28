'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Flag {
  id: string
  flag_type: string
  details: Record<string, unknown>
  reviewed: boolean
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  user_id: string
  artists: { name: string; slug: string } | null
}

const FLAG_LABELS: Record<string, string> = {
  high_chargeback_rate: 'High Chargeback Rate',
  chargeback_volume: 'Chargeback Volume',
  rapid_transactions: 'Rapid Transactions',
  failed_payouts: 'Failed Payouts',
  manual_review: 'Manual Review',
}

const MANUAL_FLAG_TYPES = [
  { value: 'manual_review', label: 'Manual Review' },
  { value: 'high_chargeback_rate', label: 'High Chargeback Rate' },
  { value: 'rapid_transactions', label: 'Rapid Transactions' },
  { value: 'failed_payouts', label: 'Failed Payouts' },
]

export function FlagsClient() {
  const [flags, setFlags] = useState<Flag[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unreviewed'>('unreviewed')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [artistName, setArtistName] = useState('')
  const [flagType, setFlagType] = useState('manual_review')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  async function raiseFlag() {
    if (!artistName.trim()) return
    setSubmitting(true)
    setMessage('')
    const res = await fetch('/api/admin/flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist_name: artistName.trim(), flag_type: flagType, notes: notes.trim() }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage(`Flag raised for ${data.artist_name}`)
      setArtistName('')
      setNotes('')
      window.location.reload()
    } else {
      setMessage(data.error || 'Failed to raise flag')
    }
    setSubmitting(false)
  }

  useEffect(() => {
    fetch('/api/admin/flags')
      .then(r => r.json())
      .then(d => setFlags(d.flags || []))
      .finally(() => setLoading(false))
  }, [])

  async function markReviewed(id: string) {
    await fetch(`/api/admin/flags/${id}`, { method: 'PATCH' })
    setFlags(prev =>
      prev.map(f =>
        f.id === id
          ? { ...f, reviewed: true, reviewed_at: new Date().toISOString() }
          : f,
      ),
    )
  }

  const filtered = filter === 'all' ? flags : flags.filter(f => !f.reviewed)

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-300 mb-2 block">
              &larr; Admin
            </Link>
            <h1 className="text-2xl font-bold">Security Flags</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('unreviewed')}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                filter === 'unreviewed'
                  ? 'bg-orange-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300'
              }`}
            >
              Unreviewed
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-orange-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300'
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Raise flag manually */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-bold mb-3">Raise Flag Manually</h2>
          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <input type="text" placeholder="Artist name or slug" value={artistName} onChange={e => setArtistName(e.target.value)} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-orange-600" />
            <select value={flagType} onChange={e => setFlagType(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-600 cursor-pointer">
              {MANUAL_FLAG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') raiseFlag() }} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-orange-600" />
            <button onClick={raiseFlag} disabled={submitting || !artistName.trim()} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-sm px-5 py-2 rounded-lg transition-colors">
              {submitting ? '...' : 'Raise'}
            </button>
          </div>
          {message && <p className={`text-sm mt-2 font-medium ${message.startsWith('Flag') ? 'text-green-400' : 'text-red-400'}`}>{message}</p>}
        </div>

        {loading ? (
          <div className="text-zinc-500 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-zinc-500 text-sm">No flags to show.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(flag => (
              <div
                key={flag.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden"
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === flag.id ? null : flag.id)}
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {flag.artists?.name || 'Unknown'}
                      </span>
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                        {FLAG_LABELS[flag.flag_type] || flag.flag_type}
                      </span>
                      {flag.reviewed && (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                          Reviewed
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {new Date(flag.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <span className="text-zinc-500 text-sm">
                    {expandedId === flag.id ? '▲' : '▼'}
                  </span>
                </div>

                {expandedId === flag.id && (
                  <div className="px-4 pb-4 border-t border-zinc-800 pt-3">
                    <pre className="text-xs text-zinc-400 bg-zinc-950 rounded p-3 mb-3 overflow-x-auto">
                      {JSON.stringify(flag.details, null, 2)}
                    </pre>
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/${flag.artists?.slug || ''}`}
                        className="text-xs text-orange-400 hover:text-orange-300"
                      >
                        View artist profile &rarr;
                      </Link>
                      {!flag.reviewed && (
                        <button
                          onClick={() => markReviewed(flag.id)}
                          className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Mark as reviewed
                        </button>
                      )}
                    </div>
                    {flag.reviewed && flag.reviewed_by && (
                      <div className="text-xs text-zinc-600 mt-2">
                        Reviewed by {flag.reviewed_by}
                        {flag.reviewed_at && ` on ${new Date(flag.reviewed_at).toLocaleDateString()}`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
