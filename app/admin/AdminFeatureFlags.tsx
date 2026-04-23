'use client'

import { useState } from 'react'

interface Flag {
  id: string
  key: string
  value: string
  description: string
  updated_at: string
  updated_by: string | null
}

export function AdminFeatureFlags({ initialFlags }: { initialFlags: Flag[] }) {
  const [flags, setFlags] = useState(initialFlags)
  const [toggling, setToggling] = useState<string | null>(null)

  async function toggle(flag: Flag) {
    const newValue = flag.value === 'true' ? 'false' : 'true'

    if (flag.value === 'true') {
      const ok = window.confirm(`Disabling "${flag.key}" will hide it for all users. Continue?`)
      if (!ok) return
    }

    setToggling(flag.key)
    try {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: flag.key, value: newValue }),
      })
      if (res.ok) {
        setFlags(prev => prev.map(f =>
          f.key === flag.key
            ? { ...f, value: newValue, updated_at: new Date().toISOString() }
            : f
        ))
      }
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="space-y-2">
      {flags.map(flag => (
        <div
          key={flag.key}
          className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4"
        >
          <div className="flex-1 min-w-0">
            <p className="font-mono text-sm font-bold text-zinc-200">{flag.key}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{flag.description}</p>
            {flag.updated_by && (
              <p className="text-[10px] text-zinc-600 mt-1">
                Last changed {new Date(flag.updated_at).toLocaleDateString()} by {flag.updated_by}
              </p>
            )}
          </div>
          <button
            onClick={() => toggle(flag)}
            disabled={toggling === flag.key}
            className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ml-4 ${
              flag.value === 'true' ? 'bg-orange-600' : 'bg-zinc-700'
            } ${toggling === flag.key ? 'opacity-50' : ''}`}
          >
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                flag.value === 'true' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      ))}
    </div>
  )
}
