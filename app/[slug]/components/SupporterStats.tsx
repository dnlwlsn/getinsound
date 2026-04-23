import type { FanStats } from './types'

export function SupporterStats({ stats, favouriteGenre, accent }: {
  stats: FanStats
  favouriteGenre: string | null
  accent: string
}) {
  return (
    <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl p-8">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-6">Supporter Stats</h2>
      <div className="space-y-5">
        {stats.supporterSince && (
          <div>
            <p className="text-xs text-zinc-500">Supporter since</p>
            <p className="font-display font-bold text-lg">{stats.supporterSince}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-zinc-500">Artists supported</p>
          <p className="font-display font-bold text-lg">{stats.totalArtists}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Releases owned</p>
          <p className="font-display font-bold text-lg">{stats.totalReleases}</p>
        </div>
        {stats.mostSupportedArtist && (
          <div>
            <p className="text-xs text-zinc-500">Most supported</p>
            <p className="font-display font-bold text-lg">{stats.mostSupportedArtist.name}</p>
            <p className="text-[10px] text-zinc-600">
              {stats.mostSupportedArtist.count} release{stats.mostSupportedArtist.count !== 1 ? 's' : ''}
            </p>
          </div>
        )}
        {favouriteGenre && (
          <div>
            <p className="text-xs text-zinc-500">Favourite genre</p>
            <p className="font-display font-bold text-lg capitalize">{favouriteGenre}</p>
          </div>
        )}
      </div>
    </div>
  )
}
