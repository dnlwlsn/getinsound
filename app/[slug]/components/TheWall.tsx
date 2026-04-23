import type { WallPost } from './types'
import { WallPostCard } from './WallPost'

export function TheWall({ posts }: { posts: WallPost[] }) {
  if (posts.length === 0) return null

  return (
    <div className="lg:col-span-2 bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="font-display text-xl font-bold">The Wall</h2>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Artist updates</span>
      </div>
      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
        {posts.map(post => (
          <WallPostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  )
}
