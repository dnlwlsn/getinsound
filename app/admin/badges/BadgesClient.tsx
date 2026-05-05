'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface BadgeEntry {
  id: string
  user_id: string
  badge_type: string
  awarded_at: string
  metadata: Record<string, unknown> | null
  fan_profiles: { username: string; avatar_url: string | null } | null
}

const BADGE_TYPES = [
  { value: 'founder', label: 'Founder' },
  { value: 'beta_tester', label: 'Beta Tester' },
  { value: 'founding_fan', label: 'Founding Fan' },
  { value: 'founding_artist', label: 'Founding Artist' },
  { value: 'first_sale', label: 'First Sale' },
  { value: 'early_supporter', label: 'Early Supporter' },
  { value: 'limited_edition', label: 'Limited Edition' },
]

function badgeLabel(type: string): string {
  return BADGE_TYPES.find(b => b.value === type)?.label ?? type
}

export function BadgesClient() {
  const [badges, setBadges] = useState<BadgeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [badgeType, setBadgeType] = useState(BADGE_TYPES[0].value)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/badges')
    if (res.ok) {
      const data = await res.json()
      setBadges(data.badges ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function award() {
    if (!username.trim()) return
    setSubmitting(true)
    setMessage('')
    const res = await fetch('/api/admin/badges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), badge_type: badgeType }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage(`Awarded ${badgeLabel(badgeType)} badge to @${username.trim()}`)
      setUsername('')
      load()
    } else {
      setMessage(data.error || 'Failed to award badge')
    }
    setSubmitting(false)
  }

  async function revoke(badgeId: string) {
    const res = await fetch('/api/admin/badges', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ badge_id: badgeId }),
    })
    if (res.ok) load()
  }

  const filtered = filter === 'all' ? badges : badges.filter(b => b.badge_type === filter)
  const typeCounts = badges.reduce<Record<string, number>>((acc, b) => {
    acc[b.badge_type] = (acc[b.badge_type] || 0) + 1
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-insound-bg text-zinc-100 p-8">
      <div className="max-w-3xl mx-auto space-y-10">
        <div>
          <Link href="/admin" className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors">&larr; Admin</Link>
          <h1 className="text-3xl font-display font-bold tracking-tight mt-4">Badges</h1>
          <p className="text-zinc-500 text-sm mt-1">View, award, and revoke badges for artists and fans.</p>
        </div>

        {/* Award form */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4">Award Badge</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') award() }}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-orange-600 transition-colors"
            />
            <select
              value={badgeType}
              onChange={e => setBadgeType(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-orange-600 transition-colors cursor-pointer"
            >
              {BADGE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <button
              onClick={award}
              disabled={submitting || !username.trim()}
              className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-black font-bold text-sm px-6 py-2.5 rounded-lg transition-colors"
            >
              {submitting ? 'Awarding...' : 'Award'}
            </button>
          </div>
          {message && (
            <p className={`text-sm mt-3 font-medium ${message.startsWith('Awarded') ? 'text-green-400' : 'text-red-400'}`}>
              {message}
            </p>
          )}
        </section>

        {/* Filter + list */}
        <section>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === 'all' ? 'bg-orange-600/20 text-orange-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              All ({badges.length})
            </button>
            {BADGE_TYPES.filter(t => typeCounts[t.value]).map(t => (
              <button
                key={t.value}
                onClick={() => setFilter(t.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === t.value ? 'bg-orange-600/20 text-orange-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {t.label} ({typeCounts[t.value]})
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-zinc-600 text-sm">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-zinc-600 text-sm">No {filter === 'all' ? '' : badgeLabel(filter) + ' '}badges awarded yet.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(b => (
                <BadgeRow key={b.id} badge={b} onRevoke={revoke} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function BadgeRow({ badge, onRevoke }: { badge: BadgeEntry; onRevoke: (id: string) => void }) {
  const profile = Array.isArray(badge.fan_profiles) ? badge.fan_profiles[0] : badge.fan_profiles
  const username = profile?.username ?? 'Unknown'
  const date = new Date(badge.awarded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden shrink-0">
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 m-auto mt-2 text-zinc-600">
            <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white">@{username}</p>
        <p className="text-[11px] text-zinc-500">{badgeLabel(badge.badge_type)} · Awarded {date}</p>
      </div>
      <button
        onClick={() => onRevoke(badge.id)}
        className="text-[11px] font-bold text-zinc-600 hover:text-red-400 transition-colors"
      >
        Revoke
      </button>
    </div>
  )
}
