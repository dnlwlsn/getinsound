'use client'

import { useState } from 'react'

type Props = {
  minPrice?: number
  currency?: string
  onPriceChange?: (price: number) => void
  className?: string
}

export function PayWhatYouWant({
  minPrice = 2,
  currency = '£',
  onPriceChange,
  className = '',
}: Props) {
  const [value, setValue] = useState(String(minPrice))
  const [error, setError] = useState('')

  const handleChange = (raw: string) => {
    // Allow empty or partial numeric input while typing
    if (raw === '' || /^\d+\.?\d{0,2}$/.test(raw)) {
      setValue(raw)
      setError('')
    }
  }

  const handleBlur = () => {
    const num = parseFloat(value)
    if (isNaN(num) || num < minPrice) {
      setValue(String(minPrice))
      setError(`Minimum ${currency}${minPrice}`)
      onPriceChange?.(minPrice)
    } else {
      setValue(num.toFixed(2))
      setError('')
      onPriceChange?.(num)
    }
  }

  return (
    <div className={className}>
      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
        Pay what you want
      </label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-display font-bold text-lg text-zinc-400">
          {currency}
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          className="w-full pl-9 pr-4 py-3 rounded-xl font-display font-bold text-lg
            bg-white/[0.04] ring-1 ring-white/[0.08] text-white
            focus:outline-none focus:ring-[#F56D00]
            [html[data-theme=light]_&]:bg-zinc-50 [html[data-theme=light]_&]:ring-zinc-200
            [html[data-theme=light]_&]:text-zinc-900 [html[data-theme=light]_&]:focus:ring-[#F56D00]
            transition-all duration-150"
        />
      </div>
      {error ? (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      ) : (
        <p className="text-[10px] text-zinc-600 mt-1">{currency}{minPrice} minimum</p>
      )}
    </div>
  )
}
