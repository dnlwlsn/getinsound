'use client'

import type { ViewMode } from '@/lib/useViewMode'

interface Props {
  mode: ViewMode
  onToggle: (mode: ViewMode) => void
}

function GridIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#F56D00' : '#666'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function ListIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#F56D00' : '#666'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

export function ViewToggle({ mode, onToggle }: Props) {
  return (
    <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
      <button
        onClick={() => onToggle('expanded')}
        className="p-1.5 rounded-lg transition-colors"
        style={{ background: mode === 'expanded' ? 'rgba(245,109,0,0.12)' : 'transparent' }}
        aria-label="Grid view"
      >
        <GridIcon active={mode === 'expanded'} />
      </button>
      <button
        onClick={() => onToggle('compact')}
        className="p-1.5 rounded-lg transition-colors"
        style={{ background: mode === 'compact' ? 'rgba(245,109,0,0.12)' : 'transparent' }}
        aria-label="List view"
      >
        <ListIcon active={mode === 'compact'} />
      </button>
    </div>
  )
}
