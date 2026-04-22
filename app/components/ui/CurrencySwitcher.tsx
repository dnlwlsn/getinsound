'use client'

import { useCurrency } from '../../providers/CurrencyProvider'
import { SUPPORTED_CURRENCIES } from '../../lib/currency'

export function CurrencySwitcher() {
  const { currency, setCurrency } = useCurrency()

  return (
    <div className="flex items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="w-4 h-4 text-zinc-500"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z"
          clipRule="evenodd"
        />
      </svg>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className="bg-transparent text-xs font-semibold text-zinc-500 hover:text-zinc-300
          border border-zinc-800 rounded px-2 py-1 cursor-pointer
          focus:outline-none focus:border-[#F56D00] focus:text-zinc-200
          transition-colors appearance-none
          [html[data-theme=light]_&]:border-zinc-300
          [html[data-theme=light]_&]:text-zinc-600
          [html[data-theme=light]_&]:hover:text-zinc-900
          [html[data-theme=light]_&]:focus:border-[#F56D00]"
        aria-label="Select currency"
      >
        {SUPPORTED_CURRENCIES.map(({ code, label }) => (
          <option key={code} value={code} className="bg-zinc-900 text-zinc-200">
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}
