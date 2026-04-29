'use client'

import { useState } from 'react'
import { GenreMoodBoard, type Genre } from './GenreMoodBoard'

interface GenrePromptCardProps {
  onSaved?: () => void
}

export function GenrePromptCard({ onSaved }: GenrePromptCardProps) {
  const [dismissed, setDismissed] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function dismiss() {
    sessionStorage.setItem('insound_genre_prompt_dismissed', '1')
    setDismissed(true)
  }

  async function handleComplete(genres: Genre[]) {
    setError(null)
    try {
      const res = await fetch('/api/fan-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genres }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to save')
        return
      }
    } catch {
      setError('Network error. Try again.')
      return
    }
    setShowPicker(false)
    setDismissed(true)
    onSaved?.()
  }

  async function handleSkip() {
    try {
      await fetch('/api/fan-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skip: true }),
      })
    } catch {}
    setShowPicker(false)
    dismiss()
  }

  if (dismissed) return null
  if (typeof window !== 'undefined' && sessionStorage.getItem('insound_genre_prompt_dismissed')) return null

  if (showPicker) {
    return (
      <>
        <GenreMoodBoard onComplete={handleComplete} onSkip={handleSkip} onClose={() => setShowPicker(false)} />
        {error && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-red-600/90 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg max-w-sm text-center">
            {error}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="relative bg-zinc-900/60 ring-1 ring-white/[0.06] rounded-2xl p-6 flex items-center gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-orange-600/10 flex items-center justify-center">
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-orange-500">
          <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white">Personalise your feed</p>
        <p className="text-xs text-zinc-400 mt-0.5">Pick your genres to get better recommendations.</p>
      </div>
      <button
        onClick={() => setShowPicker(true)}
        className="flex-shrink-0 bg-orange-600 text-black text-xs font-black uppercase tracking-wider px-4 py-2 rounded-full hover:bg-orange-500 transition-colors"
      >
        Pick genres
      </button>
      <button onClick={dismiss} className="absolute top-2 right-2 text-zinc-600 hover:text-zinc-400 transition-colors" aria-label="Dismiss">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
