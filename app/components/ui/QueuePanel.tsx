'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { usePlayerStore } from '@/lib/stores/player'
import { resolveAccent } from '@/lib/accent'

interface Props {
  open: boolean
  onClose: () => void
}

export function QueuePanel({ open, onClose }: Props) {
  const { queue, queueIndex, currentTrack } = usePlayerStore()
  const accent = resolveAccent(currentTrack?.accentColour)

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const upcoming = queue.slice(queueIndex + 1)

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-zinc-950 border-l border-white/[0.06] flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">Queue</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors" aria-label="Close queue">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {currentTrack && (
            <div className="px-5 pt-4 pb-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3">Now Playing</p>
              <div className="flex items-center gap-3 p-2 rounded-xl" style={{ background: `${accent}10` }}>
                {currentTrack.coverUrl ? (
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"><Image src={currentTrack.coverUrl} fill className="object-cover" sizes="40px" alt="" /></div>
                ) : (
                  <div className="w-10 h-10 rounded-lg flex-shrink-0" style={{ background: accent }} />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
                  <p className="text-xs text-zinc-500 truncate">{currentTrack.artistName}</p>
                </div>
                <div className="ml-auto flex-shrink-0">
                  <span className="w-2 h-2 rounded-full inline-block animate-pulse" style={{ background: accent }} />
                </div>
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="px-5 pt-4 pb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3">Up Next</p>
              <div className="flex flex-col gap-1">
                {upcoming.map((track, i) => (
                  <button
                    key={`${track.id}-${i}`}
                    onClick={() => {
                      const { play } = usePlayerStore.getState()
                      play(track, queue)
                    }}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-900 transition-colors text-left w-full"
                  >
                    <span className="text-[10px] font-bold text-zinc-700 w-5 text-center flex-shrink-0">{i + 1}</span>
                    {track.coverUrl ? (
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden flex-shrink-0"><Image src={track.coverUrl} fill className="object-cover" sizes="36px" alt="" /></div>
                    ) : (
                      <div className="w-9 h-9 rounded-lg flex-shrink-0 bg-zinc-800" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{track.title}</p>
                      <p className="text-xs text-zinc-600 truncate">{track.artistName}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {upcoming.length === 0 && currentTrack && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-zinc-600">No more tracks in queue</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
