'use client'

import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts'

type EarningsHistory = { month: string; earnings: number; sales: number }[]
type ReleaseBreakdown = { releaseTitle: string; earnings: number; sales: number }[]

export function AnalyticsCharts({ earningsHistory, releaseBreakdown, currency = 'GBP' }: { earningsHistory: EarningsHistory; releaseBreakdown: ReleaseBreakdown; currency?: string }) {
  const sym = { GBP: '£', USD: '$', EUR: '€' }[currency] || currency + ' '
  const hasEarnings = earningsHistory.some(d => d.earnings > 0 || d.sales > 0)
  const hasReleases = releaseBreakdown.some(d => d.earnings > 0)

  if (!hasEarnings && !hasReleases) return null

  return (
    <div className="space-y-4 mb-10">
      {hasEarnings && (
        <div className="bg-zinc-900 rounded-xl p-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">Monthly Earnings</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={earningsHistory} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F56D00" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#F56D00" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} tickFormatter={v => `${sym}${v}`} width={45} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(value) => [`${sym}${Number(value).toFixed(2)}`, 'Earnings']}
              />
              <Area type="monotone" dataKey="earnings" stroke="#F56D00" strokeWidth={2} fill="url(#earnGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasReleases && (
        <div className="bg-zinc-900 rounded-xl p-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">Earnings by Release</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={releaseBreakdown} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="releaseTitle" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} tickFormatter={v => `${sym}${v}`} width={45} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(value) => [`${sym}${Number(value).toFixed(2)}`, 'Earnings']}
              />
              <Bar dataKey="earnings" fill="#F56D00" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
