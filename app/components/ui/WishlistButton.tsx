'use client'

import { useEffect } from 'react'
import { useWishlistStore } from '@/lib/stores/wishlist'

interface Props {
  releaseId: string
  size?: number
  className?: string
}

export function WishlistButton({ releaseId, size = 18, className = '' }: Props) {
  const { hydrated, hydrate, toggle, isSaved } = useWishlistStore()
  const saved = isSaved(releaseId)

  useEffect(() => { hydrate() }, [hydrate])

  if (!hydrated) return null

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(releaseId) }}
      aria-label={saved ? 'Remove from wishlist' : 'Save for later'}
      className={`transition-colors ${className}`}
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
  )
}
