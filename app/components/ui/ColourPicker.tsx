'use client'

import { useState } from 'react'

// 15 curated colours, all vibrant and accessible on #09090b
export const ACCENT_PALETTE = [
  { hex: '#F56D00', name: 'Insound Orange' },
  { hex: '#3B82F6', name: 'Blue' },
  { hex: '#06B6D4', name: 'Cyan' },
  { hex: '#14B8A6', name: 'Teal' },
  { hex: '#10B981', name: 'Emerald' },
  { hex: '#22C55E', name: 'Green' },
  { hex: '#EAB308', name: 'Yellow' },
  { hex: '#F59E0B', name: 'Amber' },
  { hex: '#EF4444', name: 'Red' },
  { hex: '#F43F5E', name: 'Rose' },
  { hex: '#EC4899', name: 'Pink' },
  { hex: '#D946EF', name: 'Fuchsia' },
  { hex: '#A855F7', name: 'Purple' },
  { hex: '#8B5CF6', name: 'Violet' },
  { hex: '#6366F1', name: 'Indigo' },
] as const

export type AccentColour = (typeof ACCENT_PALETTE)[number]['hex']

type Props = {
  value?: string | null
  onChange?: (colour: string) => void
  className?: string
}

export function ColourPicker({ value, onChange, className = '' }: Props) {
  const [selected, setSelected] = useState<string>(value || '#F56D00')

  const handleSelect = (hex: string) => {
    setSelected(hex)
    onChange?.(hex)
  }

  return (
    <div className={className}>
      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
        Accent colour
      </label>
      <div className="grid grid-cols-5 gap-3">
        {ACCENT_PALETTE.map(({ hex, name }) => (
          <button
            key={hex}
            type="button"
            onClick={() => handleSelect(hex)}
            title={name}
            className={`relative w-10 h-10 rounded-full transition-all duration-150
              hover:scale-110 active:scale-95
              ${selected === hex
                ? 'ring-2 ring-white ring-offset-2 ring-offset-insound-bg scale-110'
                : 'ring-1 ring-white/[0.1]'}`}
            style={{ backgroundColor: hex }}
          >
            {selected === hex && (
              <svg
                className="absolute inset-0 m-auto w-4 h-4"
                viewBox="0 0 16 16"
                fill="none"
                stroke={isLightColour(hex) ? '#09090b' : '#FFFFFF'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8l3.5 3.5L13 5" />
              </svg>
            )}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-zinc-600 mt-2">
        {ACCENT_PALETTE.find((c) => c.hex === selected)?.name || 'Custom'}
      </p>
    </div>
  )
}

// Determine if a hex colour is "light" for accessible tick colour
function isLightColour(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  // Relative luminance approximation
  return (r * 0.299 + g * 0.587 + b * 0.114) > 150
}
