'use client'

import { useState } from 'react'

type BadgeType = 'founding_artist' | 'founding_fan' | 'first_sale' | 'beta_tester' | 'founder'

/** Matches Tailwind theme orange-600 */
const ORANGE_600 = '#F56D00'

const CONFIG: Record<BadgeType, { label: string; color: string; tooltip: string }> = {
  founder: {
    label: 'Founder',
    color: ORANGE_600,
    tooltip: 'Founder of Insound',
  },
  founding_artist: {
    label: 'Founding Artist',
    color: ORANGE_600,
    tooltip: 'Founding Artist - one of the first 50',
  },
  founding_fan: {
    label: 'Founding Fan',
    color: ORANGE_600,
    tooltip: 'Founding Fan - one of the first 1,000 supporters',
  },
  beta_tester: {
    label: 'Beta Tester',
    color: '#A78BFA',
    tooltip: 'Helped test Insound during beta',
  },
  first_sale: {
    label: 'First Sale',
    color: '#22C55E',
    tooltip: 'Earned their first sale on Insound',
  },
}

function ShieldIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="none" className="shrink-0">
      <path
        d="M6 0.5L11.5 2.5V6.5C11.5 10 9 12.5 6 13.5C3 12.5 0.5 10 0.5 6.5V2.5L6 0.5Z"
        fill={color}
      />
      <path
        d="M5.2 9.1L3.5 7.4L4.2 6.7L5.2 7.7L7.8 5.1L8.5 5.8L5.2 9.1Z"
        fill="#000"
      />
    </svg>
  )
}

export function Badge({ type, position, size = 'sm' }: {
  type: string
  position?: number
  size?: 'sm' | 'xs'
}) {
  const [showTooltip, setShowTooltip] = useState(false)
  const config = CONFIG[type as BadgeType]
  if (!config) return null

  const tooltipText = position
    ? `${config.tooltip} (#${position})`
    : config.tooltip

  return (
    <span
      className="relative inline-flex items-center gap-1 cursor-default"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-widest ${
          size === 'xs'
            ? 'text-[8px] px-2 py-0.5'
            : 'text-[10px] px-2.5 py-1'
        }`}
        style={{ background: `${config.color}18`, color: config.color }}
      >
        <ShieldIcon color={config.color} />
        {config.label}
      </span>

      {showTooltip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-200 font-medium whitespace-nowrap z-50 shadow-xl pointer-events-none">
          {tooltipText}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-zinc-800" />
        </span>
      )}
    </span>
  )
}

export function BadgeList({ badges, size = 'sm' }: {
  badges: Array<{ badge_type: string; metadata?: { position?: number } | null }>
  size?: 'sm' | 'xs'
}) {
  if (!badges.length) return null
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {badges.map(b => (
        <Badge
          key={b.badge_type}
          type={b.badge_type}
          position={b.metadata?.position}
          size={size}
        />
      ))}
    </span>
  )
}
