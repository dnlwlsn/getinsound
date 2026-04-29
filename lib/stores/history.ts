import { type Track } from './player'

const STORAGE_KEY = 'insound-recently-played'
const MAX_ITEMS = 20

export interface HistoryEntry {
  track: Track
  playedAt: number
}

function load(): HistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function save(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {}
}

export function addToHistory(track: Track) {
  const entries = load().filter(e => e.track.id !== track.id)
  entries.unshift({ track, playedAt: Date.now() })
  save(entries.slice(0, MAX_ITEMS))
}

export function getHistory(): HistoryEntry[] {
  return load()
}

export function getRecentlyPlayedReleases(): { releaseId: string; releaseSlug: string; releaseTitle: string; artistName: string; artistSlug: string; coverUrl: string | null; accentColour: string | null }[] {
  const entries = load()
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
