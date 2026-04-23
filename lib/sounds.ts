export const SOUNDS = [
  'Indie', 'Alternative', 'Electronic', 'Hip-Hop',
  'Folk', 'Ambient', 'Post-Rock', 'Jazz',
  'Soul', 'Punk', 'Metal', 'Classical',
  'R&B', 'Experimental', 'Singer-Songwriter', 'World',
] as const

export type Sound = (typeof SOUNDS)[number]

export const SOUNDS_SET = new Set<string>(SOUNDS)

export const MAX_RELEASE_TAGS = 3
export const MAX_TAG_LENGTH = 30
