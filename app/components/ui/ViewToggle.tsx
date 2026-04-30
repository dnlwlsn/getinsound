'use client'

import type { ViewMode } from '@/lib/useViewMode'

interface Props {
  mode: ViewMode
  onToggle: (mode: ViewMode) => void
  showPlaylist?: boolean
}

function GridIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={active ? 'text-orange-600' : 'text-zinc-500'}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function ListIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={active ? 'text-orange-600' : 'text-zinc-500'}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function PlaylistIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={active ? 'text-orange-600' : 'text-zinc-500'}>
      <line x1="3" y1="6" x2="15" y2="6" />
      <line x1="3" y1="12" x2="15" y2="12" />
      <line x1="3" y1="18" x2="11" y2="18" />
      <circle cx="19" cy="16" r="3" />
      <line x1="19" y1="13" x2="19" y2="10" />
    </svg>
  )
}

export function ViewToggle({ mode, onToggle, showPlaylist = false }: Props) {
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
      {showPlaylist && (
        <button
          onClick={() => onToggle('playlist')}
          className="p-1.5 rounded-lg transition-colors"
          style={{ background: mode === 'playlist' ? 'rgba(245,109,0,0.12)' : 'transparent' }}
          aria-label="Playlist view"
        >
          <PlaylistIcon active={mode === 'playlist'} />
        </button>
      )}
    </div>
  )
}
