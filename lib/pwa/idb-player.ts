import { get, set } from 'idb-keyval'
import type { Track } from '@/lib/stores/player'

const STORE_KEY = 'insound-player-state'

export interface PersistedPlayerState {
  currentTrack: Track | null
  queue: Track[]
  queueIndex: number
  currentTime: number
  volume: number
  isMuted: boolean
}

export async function loadPlayerState(): Promise<PersistedPlayerState | null> {
  try {
    return await get<PersistedPlayerState>(STORE_KEY) ?? null
  } catch {
    return null
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let timeTimer: ReturnType<typeof setTimeout> | null = null
let pendingState: PersistedPlayerState | null = null

export function savePlayerState(state: PersistedPlayerState): void {
  pendingState = state
  if (!saveTimer) {
    saveTimer = setTimeout(() => {
      saveTimer = null
      if (pendingState) {
        set(STORE_KEY, pendingState).catch(() => {})
        pendingState = null
      }
    }, 500)
  }
}

export function savePlayerTime(currentTime: number): void {
  if (!timeTimer) {
    timeTimer = setTimeout(async () => {
      timeTimer = null
      try {
        const stored = await get<PersistedPlayerState>(STORE_KEY)
        if (stored) {
          stored.currentTime = currentTime
          await set(STORE_KEY, stored)
        }
      } catch {}
    }, 5000)
  }
}
