'use client'

import { useState, useCallback, useEffect } from 'react'

export type ViewMode = 'compact' | 'expanded' | 'playlist'

const STORAGE_KEY = 'insound_view_mode'

export function useViewMode() {
  const [mode, setMode] = useState<ViewMode>('expanded')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'compact' || stored === 'expanded' || stored === 'playlist') {
      setMode(stored)
    }
  }, [])

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'expanded' ? 'compact' : 'expanded'
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  const set = useCallback((m: ViewMode) => {
    setMode(m)
    localStorage.setItem(STORAGE_KEY, m)
  }, [])

  return { mode, toggle, set }
}
