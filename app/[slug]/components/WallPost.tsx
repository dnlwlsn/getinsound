import Link from 'next/link'
import Image from 'next/image'
import { resolveAccent } from '@/lib/accent'
import type { WallPost as WallPostType } from './types'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export function WallPostCard({ post }: { post: WallPostType }) {
  const postAccent = resolveAccent(post.artists.accent_colour)

  return (
    <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <Link href={`/${post.artists.slug}`} className="shrink-0">
          {post.artists.avatar_url ? (
            <Image src={post.artists.avatar_url} alt={post.artists.name} width={36} height={36}
              className="rounded-full object-cover w-9 h-9" />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: `${postAccent}22`, color: postAccent }}>
              {post.artists.name[0]}
            </div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/${post.artists.slug}`} className="font-bold text-sm hover:text-white transition-colors truncate block">
            {post.artists.name}
          </Link>
          <p className="text-[10px] text-zinc-600">{timeAgo(post.created_at)}</p>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-white/[0.04] text-zinc-500">
          {post.post_type === 'voice_note' ? 'Voice Note' : post.post_type}
        </span>
      </div>
      <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{post.content}</p>
      {post.media_url && (
        <div className="mt-3 rounded-xl overflow-hidden">
          {post.post_type === 'photo' ? (
            <Image src={post.media_url} alt="Post media" width={600} height={400}
              className="w-full h-auto object-cover max-h-80" />
          ) : (
            <div className="bg-white/[0.03] rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: `${postAccent}22` }}>
                <svg width="16" height="16" fill={postAccent} viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-400 truncate">
                  {post.post_type === 'demo' ? 'Demo' : 'Voice Note'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
