'use client'

import { useEffect, useState } from 'react'
import { SettingsTabs } from '@/components/settings/SettingsTabs'

interface Session {
  id: string
  device: string
  ip_display: string
  city: string | null
  country: string | null
  last_active_at: string
  created_at: string
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function SecuritySettingsClient({ currentSessionId }: { currentSessionId: string }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then(d => setSessions(d.sessions || []))
      .finally(() => setLoading(false))
  }, [])

  async function signOut(sessionId: string) {
    await fetch('/api/sessions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    setSessions(prev => prev.filter(s => s.id !== sessionId))
  }

  async function signOutAll() {
    await fetch('/api/sessions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setSessions(prev => prev.filter(s => s.id === currentSessionId))
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <SettingsTabs />

        <h2 className="text-lg font-semibold mb-4">Active Sessions</h2>
        <p className="text-sm text-zinc-400 mb-6">
          Devices where you&apos;re currently signed in.
        </p>

        {loading ? (
          <div className="text-zinc-500 text-sm">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="text-zinc-500 text-sm">No active sessions found.</div>
        ) : (
          <div className="space-y-3">
            {sessions.map(session => {
              const isCurrent = session.id === currentSessionId
              const location = [session.city, session.country].filter(Boolean).join(', ')
              return (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-zinc-900 border border-zinc-800"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{session.device}</span>
                      {isCurrent && (
                        <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
                          This device
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {session.ip_display}
                      {location && ` · ${location}`}
                      {' · '}
                      {timeAgo(session.last_active_at)}
                    </div>
                  </div>
                  {!isCurrent && (
                    <button
                      onClick={() => signOut(session.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Sign out
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {sessions.length > 1 && (
          <button
            onClick={signOutAll}
            className="mt-6 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            Sign out all other sessions
          </button>
        )}
      </div>
    </div>
  )
}
