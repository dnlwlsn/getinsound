'use client'

import { useState } from 'react'
import { SOCIAL_PLATFORMS, type SocialPlatform, type SocialLinks, getSocialIcon } from '@/lib/verification'

interface Props {
  initial: SocialLinks
}

export function SocialAccountsEditor({ initial }: Props) {
  const [links, setLinks] = useState<SocialLinks>(initial || {})
  const [editing, setEditing] = useState<SocialPlatform | null>(null)
  const [url, setUrl] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<SocialPlatform | null>(null)

  function startEdit(platform: SocialPlatform) {
    setEditing(platform)
    setUrl(links[platform]?.url || '')
    setError('')
  }

  async function verify() {
    if (!editing || !url.trim()) return
    const config = SOCIAL_PLATFORMS.find(p => p.key === editing)
    if (config && !config.pattern.test(url.trim())) {
      setError(`Invalid URL — expected a ${config.label} link`)
      return
    }

    setVerifying(true)
    setError('')
    try {
      const res = await fetch('/api/verify-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: editing, url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Verification failed')
      } else {
        setLinks(prev => ({
          ...prev,
          [editing]: { url: url.trim(), verified: data.verified, verified_at: data.verified ? new Date().toISOString() : null },
        }))
        setEditing(null)
      }
    } catch {
      setError('Network error')
    }
    setVerifying(false)
  }

  async function remove(platform: SocialPlatform) {
    setRemoving(platform)
    try {
      const res = await fetch('/api/social-links', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      if (res.ok) {
        setLinks(prev => {
          const next = { ...prev }
          delete next[platform]
          return next
        })
      }
    } catch {}
    setRemoving(null)
  }

  return (
    <div className="space-y-3">
      {SOCIAL_PLATFORMS.map(({ key, label, placeholder }) => {
        const link = links[key]
        const isEditing = editing === key

        return (
          <div key={key} className="bg-black/20 rounded-xl p-4 ring-1 ring-white/[0.04]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill={link?.verified ? '#999' : '#52525b'}>
                  <path d={getSocialIcon(key)} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-300">{label}</p>
                {link && !isEditing && (
                  <p className="text-[10px] text-zinc-500 truncate">{link.url}</p>
                )}
              </div>

              {link && !isEditing && (
                <div className="flex items-center gap-2 shrink-0">
                  {link.verified ? (
                    <span className="text-[9px] font-bold uppercase tracking-widest text-green-500 bg-green-600/10 border border-green-600/20 px-2 py-0.5 rounded-full">
                      Verified
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
                      Not verified
                    </span>
                  )}
                  <button onClick={() => startEdit(key)} className="text-[10px] font-bold text-orange-500 hover:text-orange-400 transition-colors">
                    Edit
                  </button>
                  <button
                    onClick={() => remove(key)}
                    disabled={removing === key}
                    className="text-[10px] font-bold text-zinc-600 hover:text-red-400 disabled:opacity-50 transition-colors"
                  >
                    {removing === key ? '...' : 'Remove'}
                  </button>
                </div>
              )}

              {!link && !isEditing && (
                <button
                  onClick={() => startEdit(key)}
                  className="text-[10px] font-bold text-orange-500 hover:text-orange-400 transition-colors shrink-0"
                >
                  + Add
                </button>
              )}
            </div>

            {isEditing && (
              <div className="mt-3 space-y-2">
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 text-sm text-white placeholder:text-zinc-600 focus:border-orange-600 outline-none transition-colors"
                  autoFocus
                />
                {error && <p className="text-[10px] text-red-400 font-bold">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={verify}
                    disabled={verifying || !url.trim()}
                    className="bg-orange-600 text-black font-bold px-4 py-2 rounded-lg text-[10px] uppercase tracking-wider hover:bg-orange-500 disabled:opacity-50 transition-colors"
                  >
                    {verifying ? 'Verifying...' : 'Save & Verify'}
                  </button>
                  <button
                    onClick={() => { setEditing(null); setError('') }}
                    className="text-zinc-500 font-bold px-4 py-2 text-[10px] uppercase tracking-wider hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
