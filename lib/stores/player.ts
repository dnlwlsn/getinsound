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

  // Playback state
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean

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
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  audioUrl: null,
  isPreview: false,
  previewDuration: null,
  isExpanded: false,

  play: (track, queue) => {
    const newQueue = queue ?? [track]
    const idx = newQueue.findIndex(t => t.id === track.id)
    set({
      currentTrack: track,
      queue: newQueue,
      queueIndex: idx >= 0 ? idx : 0,
      isPlaying: true,
      currentTime: 0,
      duration: track.durationSec ?? 0,
      audioUrl: null,
      isPreview: false,
      previewDuration: null,
    })
  },

  pause: () => set({ isPlaying: false }),
  resume: () => set({ isPlaying: true }),

  next: () => {
    const { queue, queueIndex } = get()
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
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (dur) => set({ duration: dur }),
  setAudioUrl: (url, isPreview, previewDuration) => set({ audioUrl: url, isPreview, previewDuration: previewDuration ?? null }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  toggleExpanded: () => set(s => ({ isExpanded: !s.isExpanded })),
  stop: () => set({
    currentTrack: null,
    queue: [],
    queueIndex: -1,
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
    state.isMuted !== prevState.isMuted
  ) {
    savePlayerState({
      currentTrack: state.currentTrack,
      queue: state.queue,
      queueIndex: state.queueIndex,
      currentTime: state.currentTime,
      volume: state.volume,
      isMuted: state.isMuted,
    })
  }

  if (state.currentTime !== prevState.currentTime) {
    savePlayerTime(state.currentTime)
  }
})
