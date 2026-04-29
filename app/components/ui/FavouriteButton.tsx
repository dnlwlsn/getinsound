'use client'

import { useEffect, useState, useCallback } from 'react'
import { useFavouritesStore } from '@/lib/stores/favourites'
import { createClient } from '@/lib/supabase/client'

interface Props {
  trackId?: string
  releaseId?: string
  size?: number
  className?: string
  onAuthRequired?: () => void
}

export function FavouriteButton({ trackId, releaseId, size = 18, className = '', onAuthRequired }: Props) {
  const { hydrated, hydrate, toggleTrack, toggleRelease, isTrackSaved, isReleaseSaved } = useFavouritesStore()
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [showPrompt, setShowPrompt] = useState(false)
  const [error, setError] = useState(false)
  const [burst, setBurst] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
      if (user) hydrate()
    })
  }, [hydrate])

  const saved = trackId ? isTrackSaved(trackId) : releaseId ? isReleaseSaved(releaseId) : false

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (userId === null) {
      if (onAuthRequired) {
        onAuthRequired()
      } else {
        setShowPrompt(true)
        setTimeout(() => setShowPrompt(false), 3000)
      }
      return
    }

    setError(false)
    let ok = false
    if (trackId) ok = await toggleTrack(trackId)
    else if (releaseId) ok = await toggleRelease(releaseId)

    if (ok) {
      setBurst(true)
      setTimeout(() => setBurst(false), 400)
    } else {
      setError(true)
      setTimeout(() => setError(false), 2500)
    }
  }, [userId, trackId, releaseId, toggleTrack, toggleRelease, onAuthRequired])

  if (userId === undefined) return <div style={{ width: size, height: size }} />

  return (
    <span className="relative">
      <button
        onClick={handleClick}
        aria-label={saved ? 'Remove from saved' : 'Save for later'}
        className={`transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${burst ? 'heart-burst' : ''} ${className}`}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={saved ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={saved ? 'text-orange-500' : 'text-zinc-500 hover:text-orange-400'}
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>
      {showPrompt && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap bg-zinc-800 border border-zinc-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl z-50">
          Sign in to save tracks
        </span>
      )}
      {error && (
        <span role="alert" className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap bg-red-900/80 border border-red-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl z-50">
          Failed to save
        </span>
      )}
    </span>
  )
}
