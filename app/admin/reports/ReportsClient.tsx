'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Report {
  id: string
  reported_profile_type: 'artist' | 'fan'
  category: string
  details: string | null
  status: 'open' | 'resolved' | 'dismissed'
  admin_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  reported_artist_id: string | null
  reported_fan_id: string | null
  reporter: { username: string } | null
  reported_artist: { name: string; slug: string } | null
  reported_fan: { username: string; avatar_url: string | null } | null
}

const CATEGORY_LABELS: Record<string, string> = {
  dmca_copyright: 'DMCA / Copyright',
  ai_generated_music: 'AI-generated music',
  impersonation: 'Impersonation',
  harassment_hate_speech: 'Harassment / Hate speech',
  spam_scam: 'Spam / Scam',
  inappropriate_content: 'Inappropriate content',
  underage_user: 'Underage user',
  stolen_artwork: 'Stolen artwork',
  misleading_info: 'Misleading info',
  other: 'Other',
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-orange-500/20 text-orange-400',
  resolved: 'bg-green-500/20 text-green-400',
  dismissed: 'bg-zinc-500/20 text-zinc-400',
}

export function ReportsClient({ initialReports, fetchError }: { initialReports: Report[]; fetchError?: string | null }) {
  const [reports, setReports] = useState<Report[]>(initialReports)
  const [loading] = useState(false)
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionNotes, setActionNotes] = useState('')
  const [acting, setActing] = useState(false)

  async function handleAction(id: string, status: 'resolved' | 'dismissed') {
    setActing(true)
    const res = await fetch(`/api/admin/reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_notes: actionNotes.trim() || undefined }),
    })
    if (res.ok) {
      setReports(prev => prev.map(r =>
        r.id === id ? { ...r, status, admin_notes: actionNotes.trim() || null, reviewed_at: new Date().toISOString() } : r
      ))
      setActionNotes('')
    }
    setActing(false)
  }

  function profileLink(report: Report) {
    if (report.reported_profile_type === 'artist' && report.reported_artist) {
      return { href: `/${report.reported_artist.slug}`, label: report.reported_artist.name }
    }
    if (report.reported_profile_type === 'fan' && report.reported_fan) {
      return { href: `/@${report.reported_fan.username}`, label: `@${report.reported_fan.username}` }
    }
    return null
  }

  const filtered = filter === 'all' ? reports : reports.filter(r => r.status === 'open')
  const openCount = reports.filter(r => r.status === 'open').length

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-300 mb-2 block">
              &larr; Admin
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Profile Reports</h1>
              {openCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {openCount}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('open')}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                filter === 'open' ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300'
              }`}
            >
              Open
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                filter === 'all' ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300'
              }`}
            >
              All
            </button>
          </div>
        </div>

        {fetchError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-5 py-3 mb-4">
            <p className="text-sm font-bold text-red-400">Failed to load reports</p>
            <p className="text-xs text-red-400/70 mt-1 font-mono">{fetchError}</p>
          </div>
        )}

        {loading ? (
          <div className="text-zinc-500 text-sm">Loading...</div>
        ) : filtered.length === 0 && !fetchError ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-zinc-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-zinc-500 text-sm font-bold">No reports to show</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(report => {
              const link = profileLink(report)
              const expanded = expandedId === report.id

              return (
                <div key={report.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => {
                      setExpandedId(expanded ? null : report.id)
                      setActionNotes('')
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                          {report.reported_profile_type}
                        </span>
                        <span className="text-sm font-medium truncate">
                          {link?.label || 'Unknown'}
                        </span>
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                          {CATEGORY_LABELS[report.category] || report.category}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLES[report.status]}`}>
                          {report.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500">
                        <span>
                          {new Date(report.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                        {report.reporter && (
                          <span>by @{report.reporter.username}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-zinc-500 text-sm ml-3 shrink-0">
                      {expanded ? '▲' : '▼'}
                    </span>
                  </div>

                  {expanded && (
                    <div className="px-4 pb-4 border-t border-zinc-800 pt-3 space-y-3">
                      {report.details && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1">Details from reporter</p>
                          <p className="text-sm text-zinc-300 bg-zinc-950 rounded-lg p-3">{report.details}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-4">
                        {link && (
                          <Link href={link.href} className="text-xs text-orange-400 hover:text-orange-300">
                            View profile &rarr;
                          </Link>
                        )}
                      </div>

                      {report.status === 'open' && (
                        <div className="bg-zinc-950 rounded-lg p-3 space-y-3">
                          <input
                            type="text"
                            placeholder="Admin notes (optional)"
                            value={actionNotes}
                            onChange={e => setActionNotes(e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-orange-600"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAction(report.id, 'resolved')}
                              disabled={acting}
                              className="text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg transition-colors"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => handleAction(report.id, 'dismissed')}
                              disabled={acting}
                              className="text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg transition-colors"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      )}

                      {report.status !== 'open' && (
                        <div className="text-xs text-zinc-600">
                          {report.reviewed_by && <>Reviewed by {report.reviewed_by}</>}
                          {report.reviewed_at && <> on {new Date(report.reviewed_at).toLocaleDateString()}</>}
                          {report.admin_notes && <p className="text-zinc-500 mt-1">{report.admin_notes}</p>}
                        </div>
                      )}
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
