'use client'

import { useState, useEffect } from 'react'

const BARS = [
  { height: 41.664, y: 39.168 },
  { height: 64.704, y: 27.648 },
  { height: 87.744, y: 16.128 },
  { height: 69.312, y: 25.344 },
  { height: 96.960, y: 11.520 },
  { height: 64.704, y: 27.648 },
  { height: 18.624, y: 50.688 },
]

const BAR_WIDTH = 18
const GAP = 25
const RX = 3

export function PwaSplash() {
  const [phase, setPhase] = useState<'hidden' | 'icon' | 'expand' | 'fadeout' | 'done'>('hidden')

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    if (!isStandalone) return
    if (sessionStorage.getItem('insound_splash')) return

    sessionStorage.setItem('insound_splash', '1')
    setPhase('icon')

    const t1 = setTimeout(() => setPhase('expand'), 400)
    const t2 = setTimeout(() => setPhase('fadeout'), 1200)
    const t3 = setTimeout(() => setPhase('done'), 1600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  if (phase === 'hidden' || phase === 'done') return null

  const expanded = phase === 'expand' || phase === 'fadeout'

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        backgroundColor: '#0A0A0A',
        transition: 'opacity 0.4s ease-out',
        opacity: phase === 'fadeout' ? 0 : 1,
        pointerEvents: 'none',
      }}
    >
      <svg
        viewBox="0 0 193 120"
        className="w-48"
        role="img"
        aria-label="insound."
      >
        {BARS.map((bar, i) => {
          const centerX = 96.5
          const iconBars = [1, 2, 3, 4, 5]
          const isIconBar = iconBars.includes(i)

          const finalX = i * GAP
          const compactX = isIconBar
            ? centerX - ((iconBars.indexOf(i) - 2) * GAP) - BAR_WIDTH / 2
            : centerX - BAR_WIDTH / 2

          return (
            <rect
              key={i}
              width={BAR_WIDTH}
              rx={RX}
              ry={RX}
              fill="#F47429"
              style={{
                x: expanded ? finalX : compactX,
                y: bar.y,
                height: bar.height,
                opacity: !expanded && !isIconBar ? 0 : 1,
                transition: expanded
                  ? `x 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.04}s, opacity 0.4s ease ${i * 0.04}s`
                  : 'none',
              }}
            />
          )
        })}
      </svg>
    </div>
  )
}
