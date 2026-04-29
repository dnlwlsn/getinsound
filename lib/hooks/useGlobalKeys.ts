'use client'

import { useEffect } from 'react'
import { usePlayerStore } from '@/lib/stores/player'

export function useGlobalKeys() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return

      const { currentTrack, isPlaying, pause, resume, next, previous, toggleMute, setVolume, volume } = usePlayerStore.getState()
      if (!currentTrack) return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          isPlaying ? pause() : resume()
          break
        case 'ArrowRight':
          if (e.shiftKey) { e.preventDefault(); next() }
          break
        case 'ArrowLeft':
          if (e.shiftKey) { e.preventDefault(); previous() }
          break
        case 'm':
        case 'M':
          e.preventDefault()
          toggleMute()
          break
        case 'ArrowUp':
          if (e.shiftKey) { e.preventDefault(); setVolume(Math.min(1, volume + 0.1)) }
          break
        case 'ArrowDown':
          if (e.shiftKey) { e.preventDefault(); setVolume(Math.max(0, volume - 0.1)) }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
