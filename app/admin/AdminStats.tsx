'use client'

import { useCallback, useEffect, useState } from 'react'

type Period = 'today' | 'week' | 'month' | 'all'
type DetailType = 'artists' | 'fans' | 'releases' | 'sales' | 'waitlist'

interface Stats {
  artists: number
  fans: number
  releases: number
  totalSales: number
  totalRevenue: number
  artistEarnings: number
  insoundRevenue: number
  stripeFees: number
  activePreOrders: number
  merchPending: number
  waitlist: number
  waitlistRemaining: number
}

interface DetailRow {
  id: string
  name: string
  url?: string | null
  avatar?: string | null
  sub?: string
  amount?: number
  currency?: string
  created: string
  type?: string
  public?: boolean
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
]

function fmt(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function DetailModal({ type, onClose }: { type: DetailType; onClose: () => void }) {
  const [rows, setRows] = useState<DetailRow[]>([])
  const [loading, setLoading] = useState(true)

  const titles: Record<DetailType, string> = {
    artists: 'Artist Profiles',
    fans: 'Fan Profiles',
    releases: 'Published Releases',
    sales: 'Tracks Sold',
    waitlist: 'Waitlist Signups',
  }

  useEffect(() => {
    fetch(`/api/admin/details?type=${type}`)
      .then(r => r.json())
      .then(d => setRows(d.rows ?? []))
      .finally(() => setLoading(false))
  }, [type])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[70vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-300">{titles[type]}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">No records found</div>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {rows.map(row => (
                <div key={row.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800/40 transition-colors">
                  {row.avatar && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 bg-zinc-800" />
                  )}
                  {!row.avatar && (
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500 shrink-0">
                      {row.name[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {row.url ? (
                        <a href={row.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-white hover:text-orange-400 transition-colors truncate">
                          {row.name}
                        </a>
                      ) : (
                        <span className="text-sm font-semibold text-white truncate">{row.name}</span>
                      )}
                      {row.type && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">
                          {row.type}
                        </span>
                      )}
                      {row.public === false && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 shrink-0">Private</span>
                      )}
                    </div>
                    {row.sub && <p className="text-xs text-zinc-500 truncate">{row.sub}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {row.amount != null && (
                      <p className="text-sm font-bold text-orange-500">{fmt(row.amount)}</p>
                    )}
                    <p className="text-[10px] text-zinc-600">{timeAgo(row.created)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-zinc-800 text-[10px] text-zinc-600">
          Showing up to 200 most recent
        </div>
      </div>
    </div>
  )
}

export function AdminStats() {
  const [period, setPeriod] = useState<Period>('all')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [detail, setDetail] = useState<DetailType | null>(null)

  const fetchStats = useCallback(async (p: Period) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/stats?period=${p}`)
      if (res.ok) {
        const data = await res.json()
        setStats(data)
        setLastRefresh(new Date())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats(period)
    const interval = setInterval(() => fetchStats(period), 60_000)
    return () => clearInterval(interval)
  }, [period, fetchStats])

  const cards: { label: string; value: number | string; detail?: DetailType }[] = stats
    ? [
        { label: 'Artist Profiles', value: stats.artists, detail: 'artists' },
        { label: 'Fan Profiles', value: stats.fans, detail: 'fans' },
        { label: 'Published Releases', value: stats.releases, detail: 'releases' },
        { label: 'Tracks Sold', value: stats.totalSales, detail: 'sales' },
        { label: 'Total Revenue', value: fmt(stats.totalRevenue) },
        { label: 'Artist Earnings', value: fmt(stats.artistEarnings) },
        { label: 'Insound Revenue', value: fmt(stats.insoundRevenue) },
        { label: 'Stripe Fees', value: fmt(stats.stripeFees) },
        { label: 'Active Pre-orders', value: stats.activePreOrders },
        { label: 'Merch Pending', value: stats.merchPending },
        { label: 'Waitlist Signups', value: stats.waitlist, detail: 'waitlist' },
        { label: 'Waitlist Remaining', value: stats.waitlistRemaining },
      ]
    : []

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">
          Platform Stats
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md transition-colors ${
                  period === p.value
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchStats(period)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg
              className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {lastRefresh && (
        <p className="text-[10px] text-zinc-600 mb-3">
          Last updated {lastRefresh.toLocaleTimeString()} · auto-refreshes every 60s
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {stats
          ? cards.map((s) =>
              s.detail ? (
                <button
                  key={s.label}
                  onClick={() => setDetail(s.detail!)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-left hover:border-zinc-700 hover:bg-zinc-800/50 transition-colors cursor-pointer group"
                >
                  <p className="text-2xl font-black tracking-tight">{s.value}</p>
                  <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mt-1 group-hover:text-zinc-400 transition-colors">
                    {s.label} →
                  </p>
                </button>
              ) : (
                <div
                  key={s.label}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
                >
                  <p className="text-2xl font-black tracking-tight">{s.value}</p>
                  <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mt-1">
                    {s.label}
                  </p>
                </div>
              ),
            )
          : Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-pulse"
              >
                <div className="h-7 w-16 bg-zinc-800 rounded" />
                <div className="h-3 w-24 bg-zinc-800 rounded mt-2" />
              </div>
            ))}
      </div>

      {detail && <DetailModal type={detail} onClose={() => setDetail(null)} />}
    </section>
  )
}
