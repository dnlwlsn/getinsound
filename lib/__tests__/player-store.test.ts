// Mock IDB before importing the store
jest.mock('@/lib/pwa/idb-player', () => ({
  loadPlayerState: jest.fn().mockResolvedValue(null),
  savePlayerState: jest.fn(),
  savePlayerTime: jest.fn(),
}))

import { usePlayerStore, Track } from '../stores/player'

const makeTrack = (overrides: Partial<Track> = {}): Track => ({
  id: 'track-1',
  title: 'Song',
  artistName: 'Artist',
  artistSlug: 'artist',
  releaseId: 'rel-1',
  releaseSlug: 'album',
  releaseTitle: 'Album',
  coverUrl: null,
  position: 1,
  durationSec: 240,
  accentColour: null,
  purchased: false,
  ...overrides,
})

beforeEach(() => {
  usePlayerStore.getState().stop()
})

describe('player store — play', () => {
  it('sets current track and starts playing', () => {
    const track = makeTrack()
    usePlayerStore.getState().play(track)
    const state = usePlayerStore.getState()
    expect(state.currentTrack).toEqual(track)
    expect(state.isPlaying).toBe(true)
    expect(state.currentTime).toBe(0)
  })

  it('sets queue from provided tracks', () => {
    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' }), makeTrack({ id: 't3' })]
    usePlayerStore.getState().play(tracks[1], tracks)
    const state = usePlayerStore.getState()
    expect(state.queue).toHaveLength(3)
    expect(state.queueIndex).toBe(1)
    expect(state.currentTrack?.id).toBe('t2')
  })

  it('defaults queue to single track when not provided', () => {
    const track = makeTrack()
    usePlayerStore.getState().play(track)
    expect(usePlayerStore.getState().queue).toHaveLength(1)
    expect(usePlayerStore.getState().queueIndex).toBe(0)
  })

  it('resets audio URL on play', () => {
    usePlayerStore.setState({ audioUrl: 'http://old.mp3', isPreview: true })
    usePlayerStore.getState().play(makeTrack())
    expect(usePlayerStore.getState().audioUrl).toBeNull()
    expect(usePlayerStore.getState().isPreview).toBe(false)
  })
})

describe('player store — pause/resume', () => {
  it('pauses playback', () => {
    usePlayerStore.getState().play(makeTrack())
    usePlayerStore.getState().pause()
    expect(usePlayerStore.getState().isPlaying).toBe(false)
  })

  it('resumes playback', () => {
    usePlayerStore.getState().play(makeTrack())
    usePlayerStore.getState().pause()
    usePlayerStore.getState().resume()
    expect(usePlayerStore.getState().isPlaying).toBe(true)
  })
})

describe('player store — next', () => {
  it('advances to next track', () => {
    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' })]
    usePlayerStore.getState().play(tracks[0], tracks)
    usePlayerStore.getState().next()
    expect(usePlayerStore.getState().currentTrack?.id).toBe('t2')
    expect(usePlayerStore.getState().queueIndex).toBe(1)
  })

  it('does nothing at end of queue with repeat off', () => {
    const tracks = [makeTrack({ id: 't1' })]
    usePlayerStore.getState().play(tracks[0], tracks)
    usePlayerStore.getState().next()
    expect(usePlayerStore.getState().currentTrack?.id).toBe('t1')
    expect(usePlayerStore.getState().queueIndex).toBe(0)
  })

  it('wraps to start with repeat all', () => {
    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' })]
    usePlayerStore.getState().play(tracks[0], tracks)
    usePlayerStore.setState({ queueIndex: 1, repeat: 'all' })
    usePlayerStore.getState().next()
    expect(usePlayerStore.getState().currentTrack?.id).toBe('t1')
    expect(usePlayerStore.getState().queueIndex).toBe(0)
  })

  it('replays current track with repeat one', () => {
    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' })]
    usePlayerStore.getState().play(tracks[0], tracks)
    usePlayerStore.setState({ repeat: 'one', currentTime: 120 })
    usePlayerStore.getState().next()
    expect(usePlayerStore.getState().currentTrack?.id).toBe('t1')
    expect(usePlayerStore.getState().currentTime).toBe(0)
  })
})

describe('player store — previous', () => {
  it('goes to previous track when within first 3 seconds', () => {
    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' })]
    usePlayerStore.getState().play(tracks[0], tracks)
    usePlayerStore.setState({ queueIndex: 1, currentTrack: tracks[1], currentTime: 1 })
    usePlayerStore.getState().previous()
    expect(usePlayerStore.getState().currentTrack?.id).toBe('t1')
  })

  it('restarts current track when more than 3 seconds in', () => {
    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' })]
    usePlayerStore.getState().play(tracks[0], tracks)
    usePlayerStore.setState({ queueIndex: 1, currentTrack: tracks[1], currentTime: 5 })
    usePlayerStore.getState().previous()
    expect(usePlayerStore.getState().currentTrack?.id).toBe('t2')
    expect(usePlayerStore.getState().currentTime).toBe(0)
  })

  it('does nothing at start of queue within first 3 seconds', () => {
    usePlayerStore.getState().play(makeTrack(), [makeTrack()])
    usePlayerStore.setState({ currentTime: 1 })
    usePlayerStore.getState().previous()
    expect(usePlayerStore.getState().queueIndex).toBe(0)
  })
})

describe('player store — volume', () => {
  it('sets volume and unmutes', () => {
    usePlayerStore.setState({ isMuted: true })
    usePlayerStore.getState().setVolume(0.5)
    expect(usePlayerStore.getState().volume).toBe(0.5)
    expect(usePlayerStore.getState().isMuted).toBe(false)
  })

  it('clamps volume to 0-1', () => {
    usePlayerStore.getState().setVolume(-0.5)
    expect(usePlayerStore.getState().volume).toBe(0)
    usePlayerStore.getState().setVolume(1.5)
    expect(usePlayerStore.getState().volume).toBe(1)
  })

  it('toggles mute', () => {
    expect(usePlayerStore.getState().isMuted).toBe(false)
    usePlayerStore.getState().toggleMute()
    expect(usePlayerStore.getState().isMuted).toBe(true)
    usePlayerStore.getState().toggleMute()
    expect(usePlayerStore.getState().isMuted).toBe(false)
  })
})

describe('player store — repeat', () => {
  it('cycles off → all → one → off', () => {
    // stop() doesn't reset repeat, so set it explicitly
    usePlayerStore.setState({ repeat: 'off' })
    expect(usePlayerStore.getState().repeat).toBe('off')
    usePlayerStore.getState().cycleRepeat()
    expect(usePlayerStore.getState().repeat).toBe('all')
    usePlayerStore.getState().cycleRepeat()
    expect(usePlayerStore.getState().repeat).toBe('one')
    usePlayerStore.getState().cycleRepeat()
    expect(usePlayerStore.getState().repeat).toBe('off')
  })
})

describe('player store — stop', () => {
  it('resets all state', () => {
    usePlayerStore.getState().play(makeTrack())
    usePlayerStore.getState().stop()
    const state = usePlayerStore.getState()
    expect(state.currentTrack).toBeNull()
    expect(state.queue).toHaveLength(0)
    expect(state.queueIndex).toBe(-1)
    expect(state.isPlaying).toBe(false)
    expect(state.currentTime).toBe(0)
    expect(state.audioUrl).toBeNull()
    expect(state.isExpanded).toBe(false)
  })
})

describe('player store — setAudioUrl', () => {
  it('sets preview audio', () => {
    usePlayerStore.getState().setAudioUrl('http://preview.mp3', true, 30)
    const state = usePlayerStore.getState()
    expect(state.audioUrl).toBe('http://preview.mp3')
    expect(state.isPreview).toBe(true)
    expect(state.previewDuration).toBe(30)
  })

  it('sets full audio', () => {
    usePlayerStore.getState().setAudioUrl('http://full.mp3', false)
    const state = usePlayerStore.getState()
    expect(state.audioUrl).toBe('http://full.mp3')
    expect(state.isPreview).toBe(false)
    expect(state.previewDuration).toBeNull()
  })
})

describe('player store — toggleExpanded', () => {
  it('toggles expanded state', () => {
    expect(usePlayerStore.getState().isExpanded).toBe(false)
    usePlayerStore.getState().toggleExpanded()
    expect(usePlayerStore.getState().isExpanded).toBe(true)
    usePlayerStore.getState().toggleExpanded()
    expect(usePlayerStore.getState().isExpanded).toBe(false)
  })
})
