'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  artistId: string
  initialFollowing?: boolean
  initialCount?: number
}

export function FollowButton({ artistId, initialFollowing = false, initialCount = 0 }: Props) {
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [following, setFollowing] = useState(initialFollowing)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [hover, setHover] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
      if (user) {
        supabase
          .from('fan_follows')
          .select('user_id')
          .eq('user_id', user.id)
          .eq('artist_id', artistId)
          .maybeSingle()
          .then(({ data }) => {
            setFollowing(!!data)
          })
      }
    })
  }, [artistId])

  const handleClick = useCallback(async () => {
    if (userId === null) {
      setShowPrompt(true)
      setTimeout(() => setShowPrompt(false), 3000)
      return
    }

    setLoading(true)
    const wasFollowing = following
    setFollowing(!wasFollowing)
    setCount(c => wasFollowing ? c - 1 : c + 1)

    try {
      const res = await fetch('/api/follows', {
        method: wasFollowing ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist_id: artistId }),
      })
      if (!res.ok) {
        setFollowing(wasFollowing)
        setCount(c => wasFollowing ? c + 1 : c - 1)
      }
    } catch {
      setFollowing(wasFollowing)
      setCount(c => wasFollowing ? c + 1 : c - 1)
    } finally {
      setLoading(false)
    }
  }, [userId, following, artistId])

  if (userId === undefined) return null
  if (userId === artistId) return null

  const label = following ? (hover ? 'Unfollow' : 'Following') : 'Follow'

  return (
    <span className="relative">
      <button
        onClick={handleClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        disabled={loading}
        className={`
          px-4 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all
          ${loading ? 'opacity-50 cursor-not-allowed' : ''}
          ${following
            ? hover
              ? 'bg-red-900/40 text-red-400 ring-1 ring-red-500/40'
              : 'bg-orange-600 text-black'
            : 'bg-transparent text-white ring-1 ring-white/[0.12] hover:ring-orange-500/50 hover:text-orange-400'
          }
        `}
      >
        {label}
      </button>
      {count > 0 && (
        <span className="ml-2 text-[11px] text-zinc-500 font-bold">
          {count.toLocaleString()} follower{count === 1 ? '' : 's'}
        </span>
      )}
      {showPrompt && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap bg-zinc-800 border border-zinc-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl z-50">
          Sign in to follow
        </span>
      )}
    </span>
  )
}
