import { useCallback, useRef } from 'react'
import { usePlayerStore, type Track } from '@/lib/stores/player'

interface ReleaseInfo {
  id: string
  title: string
  cover_url: string | null
  artist_id: string
  artist_name: string
  artist_slug: string
  accent_colour: string | null
}

export function usePreviewPlay() {
  const play = usePlayerStore(s => s.play)
  const currentTrack = usePlayerStore(s => s.currentTrack)
  const isPlaying = usePlayerStore(s => s.isPlaying)
  const pause = usePlayerStore(s => s.pause)
  const resume = usePlayerStore(s => s.resume)
  const fetchingRef = useRef<string | null>(null)

  const playRelease = useCallback(async (release: ReleaseInfo) => {
    if (currentTrack?.releaseId === release.id) {
      isPlaying ? pause() : resume()
      return
    }

    if (fetchingRef.current === release.id) return
    fetchingRef.current = release.id

    try {
      const res = await fetch(`/api/releases/tracks?releaseId=${release.id}`)
      if (!res.ok) return
      const tracks: { id: string; title: string; position: number; duration_sec: number | null }[] = await res.json()
      if (tracks.length === 0) return

      const queue: Track[] = tracks.map(t => ({
        id: t.id,
        title: t.title,
        artistName: release.artist_name,
        artistSlug: release.artist_slug,
        releaseId: release.id,
        releaseTitle: release.title,
        coverUrl: release.cover_url,
        position: t.position,
        durationSec: t.duration_sec,
        accentColour: release.accent_colour,
        purchased: false,
      }))

      play(queue[0], queue)
    } finally {
      fetchingRef.current = null
    }
  }, [currentTrack, isPlaying, pause, resume, play])

  const isReleaseActive = useCallback((releaseId: string) => {
    return currentTrack?.releaseId === releaseId
  }, [currentTrack])

  return { playRelease, isReleaseActive, isPlaying }
}
