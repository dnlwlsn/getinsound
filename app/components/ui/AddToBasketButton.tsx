'use client'

import { useState, useCallback, useEffect } from 'react'
import { useBasketStore, type BasketItem } from '@/lib/stores/basket'

interface Props {
  item: BasketItem
  size?: number
  className?: string
  variant?: 'icon' | 'pill'
}

export function AddToBasketButton({ item, size = 16, className = '', variant = 'icon' }: Props) {
  const { add, has } = useBasketStore()
  const [showAdded, setShowAdded] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => setHydrated(true), [])

  const inBasket = hydrated && has(item)

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (inBasket) return

    add(item)
    setShowAdded(true)
    setTimeout(() => setShowAdded(false), 2000)
  }, [inBasket, add, item])

  if (variant === 'pill') {
    return (
      <span className="relative">
        <button
          onClick={handleClick}
          disabled={inBasket}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
            inBasket
              ? 'ring-1 ring-zinc-700 text-zinc-500 cursor-default'
              : 'ring-1 ring-white/[0.12] text-white hover:ring-white/[0.25] hover:bg-white/[0.04]'
          } ${className}`}
        >
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
          </svg>
          {inBasket ? 'In basket' : 'Add to basket'}
        </button>
        {showAdded && (
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap bg-zinc-800 border border-zinc-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl z-50">
            Added to basket
          </span>
        )}
      </span>
    )
  }

  return (
    <span className="relative">
      <button
        onClick={handleClick}
        disabled={inBasket}
        aria-label={inBasket ? 'In basket' : 'Add to basket'}
        className={`transition-colors ${className}`}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={inBasket ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={inBasket ? 'text-orange-500' : 'text-zinc-500 hover:text-orange-400'}
        >
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
        </svg>
      </button>
      {showAdded && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap bg-zinc-800 border border-zinc-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl z-50">
          Added to basket
        </span>
      )}
    </span>
  )
}
