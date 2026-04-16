import { create } from 'zustand'

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

  // UI state
  isExpanded: boolean // mobile: expanded vs collapsed

  // Actions
  play: (track: Track, queue?: Track[]) => void
  pause: () => void
  resume: () => void
  next: () => void
  previous: () => void
  seek: (time: number) => void
  setVolume: (vol: number) => void
  toggleMute: () => void
  setCurrentTime: (time: number) => void
  setDuration: (dur: number) => void
  setAudioUrl: (url: string, isPreview: boolean) => void
  setIsPlaying: (playing: boolean) => void
  toggleExpanded: () => void
  clearPlayer: () => void
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
      })
    }
  },

  seek: (time) => set({ currentTime: time }),
  setVolume: (vol) => set({ volume: Math.max(0, Math.min(1, vol)), isMuted: false }),
  toggleMute: () => set(s => ({ isMuted: !s.isMuted })),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (dur) => set({ duration: dur }),
  setAudioUrl: (url, isPreview) => set({ audioUrl: url, isPreview }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  toggleExpanded: () => set(s => ({ isExpanded: !s.isExpanded })),
  clearPlayer: () => set({
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    audioUrl: null,
    isPreview: false,
    isExpanded: false,
  }),
}))
