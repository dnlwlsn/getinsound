'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type PostType = 'text' | 'photo' | 'audio'

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

const TAB_MAP: Record<PostType, string> = { text: 'Text', photo: 'Photo', audio: 'Audio' }
const POST_TYPE_MAP: Record<PostType, string> = { text: 'text', photo: 'photo', audio: 'demo' }

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_AUDIO_SIZE = 20 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp3', 'audio/x-wav', 'audio/x-flac']

export function PostComposer({ artistId, artistName, onPostCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<PostType>('text')
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setContent('')
    setFile(null)
    setFilePreview(null)
    setError(null)
    setTab('text')
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setError(null)

    if (tab === 'photo') {
      if (!IMAGE_TYPES.includes(f.type)) { setError('Only JPG, PNG, GIF, WebP allowed'); return }
      if (f.size > MAX_IMAGE_SIZE) { setError('Image must be under 5 MB'); return }
      setFile(f)
      setFilePreview(URL.createObjectURL(f))
    } else {
      if (!AUDIO_TYPES.includes(f.type)) { setError('Only MP3, WAV, FLAC allowed'); return }
      if (f.size > MAX_AUDIO_SIZE) { setError('Audio must be under 20 MB'); return }
      setFile(f)
      setFilePreview(f.name)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (!f) return

    const fakeEvent = { target: { files: [f] } } as unknown as React.ChangeEvent<HTMLInputElement>
    handleFileChange(fakeEvent)
  }

  async function handlePost() {
    if (!content.trim() && tab === 'text') { setError('Write something first'); return }
    if ((tab === 'photo' || tab === 'audio') && !file) { setError('Upload a file first'); return }

    setPosting(true)
    setError(null)

    try {
      let mediaUrl: string | null = null

      if (file) {
        const supabase = createClient()
        const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
        const path = `${artistId}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('post-media')
          .upload(path, file, { upsert: false })
        if (upErr) throw new Error(upErr.message)
        const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(path)
        mediaUrl = publicUrl
      }

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_type: POST_TYPE_MAP[tab],
          content: content.trim() || (file?.name ?? ''),
          media_url: mediaUrl,
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
      {/* Tab bar */}
      <div className="flex border-b border-zinc-800">
        {(Object.keys(TAB_MAP) as PostType[]).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setFile(null); setFilePreview(null); setError(null) }}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors
              ${tab === t ? 'text-orange-500 border-b-2 border-orange-500 bg-orange-600/[0.06]' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {TAB_MAP[t]}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">
        {/* Text area */}
        <div className="relative">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value.slice(0, 1000))}
            placeholder={tab === 'text' ? 'What\'s on your mind?' : 'Add a caption (optional)'}
            rows={tab === 'text' ? 5 : 2}
            className="w-full bg-black/30 border border-zinc-800 rounded-xl p-4 text-sm text-white placeholder:text-zinc-600 resize-none focus:border-orange-600/50 outline-none transition-colors"
          />
          <span className={`absolute bottom-3 right-3 text-[10px] font-bold ${content.length > 900 ? 'text-orange-500' : 'text-zinc-600'}`}>
            {content.length}/1000
          </span>
        </div>

        {/* File upload zone */}
        {tab !== 'text' && (
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-zinc-800 rounded-xl p-6 text-center cursor-pointer hover:border-zinc-700 transition-colors"
          >
            <input
              ref={fileRef}
              type="file"
              accept={tab === 'photo' ? IMAGE_TYPES.join(',') : AUDIO_TYPES.join(',')}
              onChange={handleFileChange}
              className="hidden"
            />
            {filePreview && tab === 'photo' ? (
              <div className="space-y-3">
                <img src={filePreview} alt="Preview" className="max-h-48 mx-auto rounded-lg object-cover" />
                <button
                  onClick={e => { e.stopPropagation(); setFile(null); setFilePreview(null) }}
                  className="text-xs text-red-400 hover:text-red-300 font-bold"
                >
                  Remove
                </button>
              </div>
            ) : filePreview && tab === 'audio' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <svg width="16" height="16" fill="none" stroke="#F56D00" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                  </svg>
                  <span className="text-sm text-zinc-300 font-bold">{filePreview}</span>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setFile(null); setFilePreview(null) }}
                  className="text-xs text-red-400 hover:text-red-300 font-bold"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-zinc-500 mb-1">
                  {tab === 'photo' ? 'Drop an image or click to upload' : 'Drop an audio file or click to upload'}
                </p>
                <p className="text-[10px] text-zinc-600">
                  {tab === 'photo' ? 'JPG, PNG, GIF, WebP — max 5 MB' : 'MP3, WAV, FLAC — max 20 MB'}
                </p>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-400 font-bold">{error}</p>}

        {/* Preview */}
        {(content.trim() || file) && (
          <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Preview</p>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-orange-600/15 flex items-center justify-center text-xs font-bold text-orange-500">
                {artistName[0]}
              </div>
              <span className="text-xs font-bold">{artistName}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/[0.04] text-zinc-500">
                {tab === 'audio' ? 'Demo' : tab}
              </span>
            </div>
            {content.trim() && (
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{content}</p>
            )}
            {filePreview && tab === 'photo' && (
              <img src={filePreview} alt="Preview" className="mt-2 max-h-40 rounded-lg object-cover" />
            )}
            {filePreview && tab === 'audio' && (
              <div className="mt-2 bg-white/[0.03] rounded-lg p-3 flex items-center gap-2">
                <svg width="14" height="14" fill="#F56D00" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                <span className="text-xs text-zinc-400 font-bold truncate">{filePreview}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
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
            disabled={posting || (!content.trim() && tab === 'text') || ((tab === 'photo' || tab === 'audio') && !file)}
            className="bg-orange-600 text-black font-bold px-6 py-2.5 rounded-xl hover:bg-orange-500 disabled:opacity-40 disabled:hover:bg-orange-600 transition-colors text-sm uppercase tracking-wider"
          >
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}
