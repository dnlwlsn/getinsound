'use client'

import { useGlobalKeys } from '@/lib/hooks/useGlobalKeys'
import { useEffect } from 'react'
import { usePlayerStore } from '@/lib/stores/player'
import { addToHistory } from '@/lib/stores/history'

export function GlobalShortcuts() {
  useGlobalKeys()

  useEffect(() => {
    return usePlayerStore.subscribe((state, prev) => {
      if (state.currentTrack && state.currentTrack !== prev.currentTrack) {
        addToHistory(state.currentTrack)
      }
    })
  }, [])

  return null
}
