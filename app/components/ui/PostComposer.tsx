'use client'

import { useState } from 'react'

interface ArtistPost {
  id: string
  post_type: string
  content: string
  media_url: string | null
  created_at: string
}

interface Props {
  artistId: string
  artistName: string
  onPostCreated: (post: ArtistPost) => void
}

export function PostComposer({ artistName, onPostCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setContent('')
    setError(null)
  }

  async function handlePost() {
    if (!content.trim()) { setError('Write something first'); return }

    setPosting(true)
    setError(null)

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_type: 'text',
          content: content.trim(),
          media_url: null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create post')
      }

      const { post } = await res.json()
      onPostCreated(post)
      reset()
      setOpen(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setPosting(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-orange-600 text-black font-bold py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider"
      >
        Share an update
      </button>
    )
  }

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="p-5 space-y-4">
        <div className="relative">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value.slice(0, 1000))}
            placeholder="What's on your mind?"
            rows={5}
            className="w-full bg-black/30 border border-zinc-800 rounded-xl p-4 text-sm text-white placeholder:text-zinc-600 resize-none focus:border-orange-600/50 outline-none transition-colors"
          />
          <span className={`absolute bottom-3 right-3 text-[10px] font-bold ${content.length > 900 ? 'text-orange-500' : 'text-zinc-600'}`}>
            {content.length}/1000
          </span>
        </div>

        {error && <p role="alert" className="text-xs text-red-400 font-bold">{error}</p>}

        {content.trim() && (
          <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Preview</p>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-orange-600/15 flex items-center justify-center text-xs font-bold text-orange-500">
                {artistName[0]}
              </div>
              <span className="text-xs font-bold">{artistName}</span>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{content}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            onClick={() => { reset(); setOpen(false) }}
            disabled={posting}
            className="text-sm text-zinc-500 hover:text-zinc-300 font-bold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePost}
            disabled={posting || !content.trim()}
            className="bg-orange-600 text-black font-bold px-6 py-2.5 rounded-xl hover:bg-orange-500 disabled:opacity-40 disabled:hover:bg-orange-600 transition-colors text-sm uppercase tracking-wider"
          >
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}
