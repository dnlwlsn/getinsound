import { create } from 'zustand'

interface WishlistState {
  ids: Set<string>
  hydrated: boolean
  hydrate: () => Promise<void>
  toggle: (releaseId: string) => Promise<void>
  isSaved: (releaseId: string) => boolean
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  ids: new Set(),
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return
    try {
      const res = await fetch('/api/wishlist')
      if (!res.ok) return
      const data = await res.json()
      set({ ids: new Set(data.map((w: any) => w.release_id)), hydrated: true })
    } catch {
      set({ hydrated: true })
    }
  },

  toggle: async (releaseId: string) => {
    const saved = get().ids.has(releaseId)
    const next = new Set(get().ids)
    if (saved) next.delete(releaseId)
    else next.add(releaseId)
    set({ ids: next })

    const res = await fetch('/api/wishlist', {
      method: saved ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ release_id: releaseId }),
    })
    if (!res.ok) {
      const rollback = new Set(get().ids)
      if (saved) rollback.add(releaseId)
      else rollback.delete(releaseId)
      set({ ids: rollback })
    }
  },

  isSaved: (releaseId: string) => get().ids.has(releaseId),
}))
