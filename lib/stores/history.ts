import { type Track } from './player'
import { createClient } from '@/lib/supabase/client'

const BASE_KEY = 'insound-recently-played'
const MAX_ITEMS = 20

let cachedUserId: string | null = null
let userIdResolved = false

export interface HistoryEntry {
  track: Track
  playedAt: number
}

/** Resolve the current user ID (cached after first call) */
async function resolveUserId(): Promise<string | null> {
  if (userIdResolved) return cachedUserId
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    cachedUserId = user?.id ?? null
  } catch {
    cachedUserId = null
  }
  userIdResolved = true
  return cachedUserId
}

function storageKey(userId: string | null): string {
  return userId ? `${BASE_KEY}:${userId}` : BASE_KEY
}

function load(userId: string | null): HistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function save(entries: HistoryEntry[], userId: string | null) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(entries))
  } catch {}
}

/**
 * Initialize the history store — resolves user and migrates
 * unscoped history to the user-scoped key if needed.
 * Call this once on app load.
 */
export async function initHistory() {
  const userId = await resolveUserId()
  if (!userId) return

  const scopedKey = storageKey(userId)
  const unscopedKey = BASE_KEY

  // Migrate: if scoped key is empty but unscoped has data, move it
  if (typeof window !== 'undefined') {
    const scoped = localStorage.getItem(scopedKey)
    const unscoped = localStorage.getItem(unscopedKey)
    if (!scoped && unscoped) {
      localStorage.setItem(scopedKey, unscoped)
      localStorage.removeItem(unscopedKey)
    }
  }
}

/** Reset the cached user ID (call on sign-out / sign-in) */
export function resetHistoryUser() {
  cachedUserId = null
  userIdResolved = false
}

export function addToHistory(track: Track) {
  const entries = load(cachedUserId).filter(e => e.track.id !== track.id)
  entries.unshift({ track, playedAt: Date.now() })
  save(entries.slice(0, MAX_ITEMS), cachedUserId)
}

export function getHistory(): HistoryEntry[] {
  return load(cachedUserId)
}

export function getRecentlyPlayedReleases(): { releaseId: string; releaseSlug: string; releaseTitle: string; artistName: string; artistSlug: string; coverUrl: string | null; accentColour: string | null }[] {
  const entries = load(cachedUserId)
  const seen = new Set<string>()
  const releases: ReturnType<typeof getRecentlyPlayedReleases> = []
  for (const e of entries) {
    if (seen.has(e.track.releaseId)) continue
    seen.add(e.track.releaseId)
    releases.push({
      releaseId: e.track.releaseId,
      releaseSlug: e.track.releaseSlug || e.track.releaseId,
      releaseTitle: e.track.releaseTitle,
      artistName: e.track.artistName,
      artistSlug: e.track.artistSlug,
      coverUrl: e.track.coverUrl,
      accentColour: e.track.accentColour,
    })
  }
  return releases
}
