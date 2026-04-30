'use client'

import { useCallback, useEffect, useState } from 'react'

type Period = 'today' | 'week' | 'month' | 'all'
type DetailType = 'artists' | 'fans' | 'releases' | 'sales'

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

const DELETABLE_TYPES: DetailType[] = ['artists', 'fans', 'releases']

function DetailModal({ type, onClose }: { type: DetailType; onClose: () => void }) {
  const [rows, setRows] = useState<DetailRow[]>([])
  const [loading, setLoading] = useState(true)
  const canDelete = DELETABLE_TYPES.includes(type)

  async function deleteRow(id: string) {
    if (!window.confirm(`Are you sure you want to delete this ${type.slice(0, -1)}? This action cannot be undone.`)) return
    const res = await fetch('/api/admin/details', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id }),
    })
    if (res.ok) setRows(prev => prev.filter(r => r.id !== id))
  }

  const titles: Record<DetailType, string> = {
    artists: 'Artist Profiles',
    fans: 'Fan Profiles',
    releases: 'Published Releases',
    sales: 'Tracks Sold',
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
                  {canDelete && (
                    <button
                      onClick={() => deleteRow(row.id)}
                      className="shrink-0 p-1.5 text-zinc-700 hover:text-red-400 transition-colors"
                      aria-label={`Delete ${row.name}`}
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  )}
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

interface ActivityEvent {
  id: string
  type: string
  text: string
  time: string
}

interface TopArtist {
  name: string
  slug: string
  avatar: string | null
  sales: number
  revenue: number
}

interface RevenueDay {
  date: string
  revenue: number
  platform: number
  count: number
}

const EVENT_ICONS: Record<string, string> = {
  signup: '👤',
  purchase: '💷',
  release: '💿',
}

function RevenueChart({ days }: { days: RevenueDay[] }) {
  const maxRevenue = Math.max(...days.map(d => d.revenue), 1)

  return (
    <div className="flex items-end gap-[3px] h-32">
      {days.map(d => {
        const h = Math.max((d.revenue / maxRevenue) * 100, d.revenue > 0 ? 4 : 1)
        const label = new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        return (
          <div
            key={d.date}
            className="flex-1 group relative"
            style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}
          >
            <div
              className={`w-full rounded-sm transition-colors ${d.revenue > 0 ? 'bg-orange-500/80 group-hover:bg-orange-400' : 'bg-zinc-800'}`}
              style={{ height: `${h}%` }}
            />
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
              <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[10px] whitespace-nowrap shadow-xl">
                <p className="font-bold text-white">{label}</p>
                <p className="text-zinc-400">£{(d.revenue / 100).toFixed(2)} · {d.count} sale{d.count !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function AdminStats() {
  const [period, setPeriod] = useState<Period>('all')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [detail, setDetail] = useState<DetailType | null>(null)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [topArtists, setTopArtists] = useState<TopArtist[]>([])
  const [revenueDays, setRevenueDays] = useState<RevenueDay[]>([])

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

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/activity').then(r => r.json()),
      fetch('/api/admin/top-artists').then(r => r.json()),
      fetch('/api/admin/revenue-chart').then(r => r.json()),
    ]).then(([act, top, rev]) => {
      setActivity(act.events ?? [])
      setTopArtists(top.artists ?? [])
      setRevenueDays(rev.days ?? [])
    })
  }, [])

  const cards: { label: string; value: number | string; detail?: DetailType }[] = stats
    ? [
        { label: 'Artist Profiles', value: stats.artists, detail: 'artists' },
        { label: 'Fan Profiles', value: stats.fans, detail: 'fans' },
        { label: 'Published Releases', value: stats.releases, detail: 'releases' },
        { label: 'Tracks Sold', value: stats.totalSales, detail: 'sales' },
        { label: 'Total Revenue', value: fmt(stats.totalRevenue) },
        { label: 'Artist Earnings', value: fmt(stats.artistEarnings) },
        { label: 'Insound Revenue', value: fmt(stats.insoundRevenue) },
        { label: 'Insound Net', value: fmt(stats.insoundRevenue - stats.stripeFees) },
        { label: 'Stripe Fees', value: fmt(stats.stripeFees) },
        { label: 'Active Pre-orders', value: stats.activePreOrders },
        { label: 'Merch Pending', value: stats.merchPending },
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

      {/* Revenue Chart + Activity + Top Artists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4">Revenue — Last 30 Days</h3>
          {revenueDays.length > 0 ? (
            <RevenueChart days={revenueDays} />
          ) : (
            <div className="h-32 flex items-center justify-center text-zinc-600 text-sm">Loading…</div>
          )}
        </div>

        {/* Top Artists */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4">Top Artists</h3>
          {topArtists.length > 0 ? (
            <div className="space-y-2.5">
              {topArtists.map((a, i) => (
                <a key={a.slug} href={`/${a.slug}`} className="flex items-center gap-3 hover:bg-zinc-800/40 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
                  <span className="text-[10px] font-bold text-zinc-600 w-4 text-right">{i + 1}</span>
                  {a.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.avatar} alt="" className="w-7 h-7 rounded-full object-cover bg-zinc-800 shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500 shrink-0">
                      {a.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{a.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-orange-500">£{(a.revenue / 100).toFixed(2)}</p>
                    <p className="text-[10px] text-zinc-600">{a.sales} sale{a.sales !== 1 ? 's' : ''}</p>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-zinc-600 text-sm">No sales yet</div>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mt-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4">Recent Activity</h3>
        {activity.length > 0 ? (
          <div className="space-y-1">
            {activity.map(e => (
              <div key={e.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-zinc-800/40 transition-colors">
                <span className="text-base shrink-0">{EVENT_ICONS[e.type] ?? '•'}</span>
                <p className="text-sm text-zinc-300 flex-1 min-w-0 truncate">{e.text}</p>
                <p className="text-[10px] text-zinc-600 shrink-0">{timeAgo(e.time)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-20 flex items-center justify-center text-zinc-600 text-sm">Loading…</div>
        )}
      </div>

      {detail && <DetailModal type={detail} onClose={() => setDetail(null)} />}
    </section>
  )
}
