'use client'

import { useState, useCallback } from 'react'
import { SOUNDS, type Sound } from '@/lib/sounds'

export type Genre = Sound

const MIN_SELECTIONS = 3
const MAX_SELECTIONS = 5

interface GenreMoodBoardProps {
  onComplete: (genres: Genre[]) => void | Promise<void>
  onSkip: () => void | Promise<void>
}

export function GenreMoodBoard({ onComplete, onSkip }: GenreMoodBoardProps) {
  const [selected, setSelected] = useState<Set<Sound>>(new Set())
  const [saving, setSaving] = useState(false)

  const toggle = useCallback((genre: Sound) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(genre)) {
        next.delete(genre)
      } else if (next.size < MAX_SELECTIONS) {
        next.add(genre)
      }
      return next
    })
  }, [])

  const canSubmit = selected.size >= MIN_SELECTIONS

  async function handleDone() {
    if (!canSubmit || saving) return
    setSaving(true)
    try {
      await onComplete(Array.from(selected))
    } finally {
      setSaving(false)
    }
  }

  async function handleSkip() {
    setSaving(true)
    try {
      await onSkip()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950">
      <div className="w-full max-w-2xl px-6 py-12 flex flex-col items-center">
        {/* Header */}
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-white text-center mb-2">
          What do you listen to?
        </h1>
        <p className="text-sm text-zinc-400 text-center mb-8">
          Pick {MIN_SELECTIONS}–{MAX_SELECTIONS} genres to personalise your discover feed.
        </p>

        {/* Genre grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full mb-8">
          {SOUNDS.map(genre => {
            const isSelected = selected.has(genre)
            const atMax = selected.size >= MAX_SELECTIONS && !isSelected
            return (
              <button
                key={genre}
                type="button"
                disabled={atMax || saving}
                onClick={() => toggle(genre)}
                className={`
                  relative px-4 py-4 rounded-xl font-display font-bold text-sm
                  transition-all duration-150 ease-out cursor-pointer
                  border
                  ${isSelected
                    ? 'bg-[#F56D00]/15 border-[#F56D00] text-[#F56D00] scale-[1.02]'
                    : 'bg-white/[0.03] border-white/[0.08] text-white hover:border-white/[0.2] hover:bg-white/[0.06]'
                  }
                  ${atMax ? 'opacity-40 cursor-not-allowed' : ''}
                  disabled:pointer-events-none
                `}
              >
                {genre}
                {isSelected && (
                  <span className="absolute top-1.5 right-2 text-[#F56D00] text-xs">✓</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Selection counter */}
        <p className="text-xs text-zinc-500 mb-6">
          {selected.size} of {MAX_SELECTIONS} selected
          {selected.size > 0 && selected.size < MIN_SELECTIONS && (
            <span className="text-zinc-600"> · pick {MIN_SELECTIONS - selected.size} more</span>
          )}
        </p>

        {/* Actions */}
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          <button
            type="button"
            disabled={!canSubmit || saving}
            onClick={handleDone}
            className={`
              w-full px-8 py-3.5 rounded-full font-semibold text-sm
              transition-all duration-150 ease-out
              ${canSubmit
                ? 'bg-[#F56D00] text-[#09090b] hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              }
              disabled:opacity-50
            `}
          >
            {saving ? 'Saving…' : 'Done'}
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSkip}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors duration-150 disabled:opacity-50"
          >
            I'll explore on my own
          </button>
        </div>
      </div>
    </div>
  )
}
