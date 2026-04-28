import { create } from 'zustand'
import { loadPlayerState, savePlayerState, savePlayerTime } from '@/lib/pwa/idb-player'

export interface Track {
  id: string
  title: string
  artistName: string
  artistSlug: string
  releaseId: string
  releaseTitle: string
  coverUrl: string | null
  position: number
  durationSec: number | null
  /** Artist accent colour — falls back to #F56D00 */
  accentColour: string | null
  /** Whether the current user has purchased this release */
  purchased: boolean
}

interface PlayerState {
  // Track state
  currentTrack: Track | null
  queue: Track[]
  queueIndex: number
  originalQueue: Track[]

  // Playback state
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  shuffle: boolean
  repeat: 'off' | 'one' | 'all'

  // Audio source
  audioUrl: string | null
  isPreview: boolean
  previewDuration: number | null

  // UI state
  isExpanded: boolean // mobile: expanded vs collapsed

  // Actions
  play: (track: Track, queue?: Track[]) => void
  pause: () => void
  resume: () => void
  next: () => void
  previous: () => void
  setVolume: (vol: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  setCurrentTime: (time: number) => void
  setDuration: (dur: number) => void
  setAudioUrl: (url: string, isPreview: boolean, previewDuration?: number | null) => void
  setIsPlaying: (playing: boolean) => void
  toggleExpanded: () => void
  stop: () => void
}

export const usePlayerStore = create<PlayerState>()((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  originalQueue: [],
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  shuffle: false,
  repeat: 'off' as const,
  audioUrl: null,
  isPreview: false,
  previewDuration: null,
  isExpanded: false,

  play: (track, queue) => {
    const { shuffle } = get()
    const newQueue = queue ?? [track]
    const idx = newQueue.findIndex(t => t.id === track.id)
    const startIdx = idx >= 0 ? idx : 0

    if (shuffle && newQueue.length > 1) {
      const current = newQueue[startIdx]
      const rest = newQueue.filter((_, i) => i !== startIdx)
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]]
      }
      const shuffled = [current, ...rest]
      set({
        currentTrack: current,
        queue: shuffled,
        queueIndex: 0,
        originalQueue: newQueue,
        isPlaying: true,
        currentTime: 0,
        duration: track.durationSec ?? 0,
        audioUrl: null,
        isPreview: false,
        previewDuration: null,
      })
    } else {
      set({
        currentTrack: track,
        queue: newQueue,
        queueIndex: startIdx,
        originalQueue: newQueue,
        isPlaying: true,
        currentTime: 0,
        duration: track.durationSec ?? 0,
        audioUrl: null,
        isPreview: false,
        previewDuration: null,
      })
    }
  },

  pause: () => set({ isPlaying: false }),
  resume: () => set({ isPlaying: true }),

  next: () => {
    const { queue, queueIndex, repeat } = get()
    if (repeat === 'one') {
      set({ currentTime: 0, isPlaying: true })
      return
    }
    if (queueIndex < queue.length - 1) {
      const nextTrack = queue[queueIndex + 1]
      set({
        currentTrack: nextTrack,
        queueIndex: queueIndex + 1,
        isPlaying: true,
        currentTime: 0,
        audioUrl: null,
        isPreview: false,
        previewDuration: null,
      })
    } else if (repeat === 'all' && queue.length > 0) {
      const firstTrack = queue[0]
      set({
        currentTrack: firstTrack,
        queueIndex: 0,
        isPlaying: true,
        currentTime: 0,
        audioUrl: null,
        isPreview: false,
        previewDuration: null,
      })
    }
  },

  previous: () => {
    const { queue, queueIndex, currentTime } = get()
    // If more than 3s in, restart current track
    if (currentTime > 3) {
      set({ currentTime: 0 })
      return
    }
    if (queueIndex > 0) {
      const prevTrack = queue[queueIndex - 1]
      set({
        currentTrack: prevTrack,
        queueIndex: queueIndex - 1,
        isPlaying: true,
        currentTime: 0,
        audioUrl: null,
        isPreview: false,
        previewDuration: null,
      })
    }
  },

  setVolume: (vol) => set({ volume: Math.max(0, Math.min(1, vol)), isMuted: false }),
  toggleMute: () => set(s => ({ isMuted: !s.isMuted })),

  toggleShuffle: () => {
    const { shuffle, queue, queueIndex, currentTrack, originalQueue } = get()
    if (!shuffle) {
      const current = queue[queueIndex]
      const rest = queue.filter((_, i) => i !== queueIndex)
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]]
      }
      set({
        shuffle: true,
        originalQueue: queue,
        queue: [current, ...rest],
        queueIndex: 0,
      })
    } else {
      const restored = originalQueue.length > 0 ? originalQueue : queue
      const idx = currentTrack ? restored.findIndex(t => t.id === currentTrack.id) : 0
      set({
        shuffle: false,
        queue: restored,
        queueIndex: idx >= 0 ? idx : 0,
      })
    }
  },

  cycleRepeat: () => {
    const { repeat } = get()
    const next = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off'
    set({ repeat: next })
  },
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (dur) => set({ duration: dur }),
  setAudioUrl: (url, isPreview, previewDuration) => set({ audioUrl: url, isPreview, previewDuration: previewDuration ?? null }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  toggleExpanded: () => set(s => ({ isExpanded: !s.isExpanded })),
  stop: () => set({
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    originalQueue: [],
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    audioUrl: null,
    isPreview: false,
    previewDuration: null,
    isExpanded: false,
  }),
}))

// Hydrate from IndexedDB on first load
if (typeof window !== 'undefined') {
  loadPlayerState().then((saved) => {
    if (!saved || !saved.currentTrack) return
    usePlayerStore.setState({
      currentTrack: saved.currentTrack,
      queue: saved.queue,
      queueIndex: saved.queueIndex,
      currentTime: saved.currentTime,
      volume: saved.volume,
      isMuted: saved.isMuted,
      shuffle: saved.shuffle ?? false,
      repeat: saved.repeat ?? 'off',
      originalQueue: saved.originalQueue ?? [],
      isPlaying: false,
    })
  })
}

// Persist to IndexedDB on relevant state changes
usePlayerStore.subscribe((state, prevState) => {
  if (!state.currentTrack) return

  if (
    state.currentTrack !== prevState.currentTrack ||
    state.queue !== prevState.queue ||
    state.queueIndex !== prevState.queueIndex ||
    state.volume !== prevState.volume ||
    state.isMuted !== prevState.isMuted ||
    state.shuffle !== prevState.shuffle ||
    state.repeat !== prevState.repeat
  ) {
    savePlayerState({
      currentTrack: state.currentTrack,
      queue: state.queue,
      queueIndex: state.queueIndex,
      currentTime: state.currentTime,
      volume: state.volume,
      isMuted: state.isMuted,
      shuffle: state.shuffle,
      repeat: state.repeat,
      originalQueue: state.originalQueue,
    })
  }

  if (state.currentTime !== prevState.currentTime) {
    savePlayerTime(state.currentTime)
  }
})
