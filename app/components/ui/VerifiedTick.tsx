'use client'

import { useState } from 'react'

export function VerifiedTick({ size = 16 }: { size?: number }) {
  const [show, setShow] = useState(false)

  return (
    <span
      className="relative inline-flex items-center cursor-default shrink-0"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className="shrink-0"
      >
        <path
          d="M9 12l2 2 4-4"
          stroke="currentColor" className="text-zinc-400"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="10" stroke="currentColor" className="text-zinc-400" strokeWidth="1.5" />
      </svg>

      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-200 font-medium whitespace-nowrap z-50 shadow-xl pointer-events-none">
          Verified - identity-verified via Stripe, independent and unsigned.
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-zinc-800" />
        </span>
      )}
    </span>
  )
}
