export interface FanRelease {
  id: string
  slug: string
  title: string
  type: string
  cover_url: string | null
  price_pence: number
}

export interface FanArtist {
  slug: string
  name: string
  accent_colour: string | null
}

export interface FanPurchase {
  id: string
  amount_pence: number
  fan_currency: string | null
  paid_at: string
  releases: FanRelease
  artists: FanArtist
}

export interface FanPinned {
  position: number
  release_id: string
  releases: FanRelease & { artists: FanArtist }
}

export interface FanBadge {
  badge_type: string
  release_id: string | null
  awarded_at: string
  metadata?: { position?: number } | null
}

export interface WallPost {
  id: string
  artist_id: string
  post_type: string
  content: string
  media_url: string | null
  created_at: string
  artists: {
    slug: string
    name: string
    accent_colour: string | null
    avatar_url: string | null
  }
}

export interface FanStats {
  supporterSince: number | null
  totalArtists: number
  totalReleases: number
  mostSupportedArtist: { name: string; count: number } | null
}

export interface FanProfile {
  id: string
  username: string
  avatar_url: string | null
  bio: string | null
  accent_colour: string | null
  is_public: boolean
  show_purchase_amounts: boolean
  show_collection: boolean
  show_wall: boolean
  created_at: string
}
