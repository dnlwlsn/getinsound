'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useBasketStore } from '@/lib/stores/basket'
import { BasketDrawer } from './BasketDrawer'

export function BasketButton() {
  const count = useBasketStore(s => s.items.length)
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative p-2 text-zinc-400 hover:text-white transition-colors"
        aria-label={`Basket (${count} items)`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-orange-600 text-black text-[10px] font-black rounded-full px-1">
            {count}
          </span>
        )}
      </button>
      {open && createPortal(
        <BasketDrawer onClose={() => setOpen(false)} />,
        document.body
      )}
    </>
  )
}
