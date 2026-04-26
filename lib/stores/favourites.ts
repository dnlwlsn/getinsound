import { create } from 'zustand'

interface FavouritesState {
  trackIds: Set<string>
  releaseIds: Set<string>
  hydrated: boolean
  hydrate: () => Promise<void>
  toggleTrack: (trackId: string) => Promise<boolean>
  toggleRelease: (releaseId: string) => Promise<boolean>
  isTrackSaved: (trackId: string) => boolean
  isReleaseSaved: (releaseId: string) => boolean
}

export const useFavouritesStore = create<FavouritesState>((set, get) => ({
  trackIds: new Set(),
  releaseIds: new Set(),
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return
    try {
      const res = await fetch('/api/favourites')
      if (!res.ok) { set({ hydrated: true }); return }
      const data: { track_id: string | null; release_id: string | null }[] = await res.json()
      set({
        trackIds: new Set(data.filter(f => f.track_id).map(f => f.track_id!)),
        releaseIds: new Set(data.filter(f => f.release_id).map(f => f.release_id!)),
        hydrated: true,
      })
    } catch {
      set({ hydrated: true })
    }
  },

  toggleTrack: async (trackId: string) => {
    const saved = get().trackIds.has(trackId)
    const next = new Set(get().trackIds)
    if (saved) next.delete(trackId); else next.add(trackId)
    set({ trackIds: next })

    const res = await fetch('/api/favourites', {
      method: saved ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track_id: trackId }),
    })
    if (!res.ok) {
      const rollback = new Set(get().trackIds)
      if (saved) rollback.add(trackId); else rollback.delete(trackId)
      set({ trackIds: rollback })
      return false
    }
    return true
  },

  toggleRelease: async (releaseId: string) => {
    const saved = get().releaseIds.has(releaseId)
    const next = new Set(get().releaseIds)
    if (saved) next.delete(releaseId); else next.add(releaseId)
    set({ releaseIds: next })

    const res = await fetch('/api/favourites', {
      method: saved ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ release_id: releaseId }),
    })
    if (!res.ok) {
      const rollback = new Set(get().releaseIds)
      if (saved) rollback.add(releaseId); else rollback.delete(releaseId)
      set({ releaseIds: rollback })
      return false
    }
    return true
  },

  isTrackSaved: (trackId: string) => get().trackIds.has(trackId),
  isReleaseSaved: (releaseId: string) => get().releaseIds.has(releaseId),
}))
