'use client'

import { useCallback, useEffect, useState } from 'react'

type Period = 'today' | 'week' | 'month' | 'all'

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

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
]

function fmt(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

export function AdminStats() {
  const [period, setPeriod] = useState<Period>('all')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

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

  const cards = stats
    ? [
        { label: 'Artist Profiles', value: stats.artists },
        { label: 'Fan Profiles', value: stats.fans },
        { label: 'Published Releases', value: stats.releases },
        { label: 'Tracks Sold', value: stats.totalSales },
        { label: 'Total Revenue', value: fmt(stats.totalRevenue) },
        { label: 'Artist Earnings', value: fmt(stats.artistEarnings) },
        { label: 'Insound Revenue', value: fmt(stats.insoundRevenue) },
        { label: 'Stripe Fees', value: fmt(stats.stripeFees) },
        { label: 'Active Pre-orders', value: stats.activePreOrders },
        { label: 'Merch Pending', value: stats.merchPending },
        { label: 'Waitlist Signups', value: stats.waitlist },
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
          ? cards.map((s) => (
              <div
                key={s.label}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
              >
                <p className="text-2xl font-black tracking-tight">{s.value}</p>
                <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mt-1">
                  {s.label}
                </p>
              </div>
            ))
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
    </section>
  )
}
