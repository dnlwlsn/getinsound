'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

interface DownloadTrack { title: string; url?: string }
interface DownloadData {
  release: { title: string; cover_url?: string; artist_name: string }
  tracks: DownloadTrack[]
  expires_at: string
}

type ViewState = 'loading' | 'ready' | 'error'

export default function DownloadClient() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')

  const [view, setView] = useState<ViewState>('loading')
  const [data, setData] = useState<DownloadData | null>(null)
  const [errorTitle, setErrorTitle] = useState('Nothing playing here.')
  const [errorMsg, setErrorMsg] = useState("This download link isn't valid.")

  useEffect(() => {
    async function load() {
      if (!sessionId) {
        setErrorTitle('Nothing playing here.')
        setErrorMsg('No session in this link.')
        setView('error')
        return
      }

      const supabase = createClient()
      const maxAttempts = 8

      for (let i = 0; i < maxAttempts; i++) {
        try {
          const { data: d, error } = await supabase.functions.invoke('download', {
            body: { session_id: sessionId },
          })
          if (d && d.release) {
            document.title = `${d.release.title} — Download | Insound`
            setData(d)
            setView('ready')
            return
          }
          let body: any = null
          try { body = await error?.context?.response?.json?.() } catch {}
          if (body && body.error !== 'pending') {
            setErrorTitle("Can't open this download.")
            setErrorMsg(body.error || 'Unknown error')
            setView('error')
            return
          }
        } catch {
          if (i === maxAttempts - 1) {
            setErrorTitle('Still finalising...')
            setErrorMsg("Your payment went through but the download isn't ready yet. Refresh in a moment.")
            setView('error')
            return
          }
        }
        await new Promise((r) => setTimeout(r, 1500))
      }

      setErrorTitle('Still finalising...')
      setErrorMsg("Your payment went through but the download isn't ready yet. Refresh in a moment.")
      setView('error')
    }
    load()
  }, [sessionId])

  if (view === 'loading') {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <div className="inline-block w-12 h-12 border-4 border-zinc-800 border-t-orange-600 rounded-full animate-spin mb-6" />
        <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2">Finalising</p>
        <h1 className="text-2xl font-black mb-2 font-display">Preparing your download...</h1>
        <p className="text-zinc-500 font-medium text-sm">This usually takes a few seconds after payment.</p>
      </div>
    )
  }

  if (view === 'error') {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-4">Something&apos;s off</p>
        <h1 className="text-3xl font-black mb-3 font-display">{errorTitle}</h1>
        <p className="text-zinc-500 font-medium mb-8">{errorMsg}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/library" className="inline-block bg-orange-600 hover:bg-orange-500 text-black font-black px-6 py-3 rounded-xl text-sm transition-colors">
            Go to My Collection
          </Link>
          <Link href="/" className="inline-block bg-zinc-800 hover:bg-zinc-700 text-white font-black px-6 py-3 rounded-xl text-sm transition-colors">
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  if (!data) return null

  const coverSrc = data.release.cover_url || 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22400%22%3E%3Crect%20width%3D%22400%22%20height%3D%22400%22%20fill%3D%22%23111%22%2F%3E%3C%2Fsvg%3E'
  const expires = new Date(data.expires_at)

  return (
    <article className="max-w-2xl mx-auto px-6 md:px-12 py-12 md:py-16 animate-slide-in-up">
      <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-4">Payment received — thank you</p>
      <div className="flex items-center gap-5 mb-10">
        <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 flex-shrink-0">
          <Image src={coverSrc} fill className="object-cover" sizes="80px" alt={`${data.release.title} cover`} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight truncate font-display">{data.release.title}</h1>
          <p className="text-zinc-500 text-sm font-bold">{data.release.artist_name}</p>
        </div>
      </div>

      <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-6 mb-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">Your files</p>
        <ol className="space-y-2">
          {data.tracks.map((t, i) => (
            <li key={i} className="flex items-center gap-4 py-3 border-b border-zinc-900 last:border-0">
              <span className="text-zinc-600 font-mono text-xs w-6">{String(i + 1).padStart(2, '0')}</span>
              <span className="font-bold text-sm flex-1 truncate">{t.title}</span>
              {t.url ? (
                <a href={t.url} className="bg-orange-600 hover:bg-orange-500 text-black font-black px-4 py-2 rounded-lg text-[10px] uppercase tracking-widest transition-colors">Download</a>
              ) : (
                <span className="text-zinc-600 text-[10px] uppercase tracking-widest font-bold">Unavailable</span>
              )}
            </li>
          ))}
        </ol>
      </div>

      <p className="text-center text-[11px] text-zinc-600 font-medium">
        Links expire {expires.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.
      </p>
      <p className="text-center text-[11px] text-zinc-600 font-medium mt-2">
        Bookmark this page — you can come back to it from the same link.
      </p>
      <div className="flex flex-col items-center gap-3 mt-8">
        <Link href="/library" className="inline-block bg-zinc-800 hover:bg-zinc-700 text-white font-black px-6 py-3 rounded-xl text-sm transition-colors">
          Go to My Collection
        </Link>
        <Link href="/signup" className="text-sm font-bold text-orange-500 hover:text-orange-400 transition-colors">
          Create a free account to keep your music forever
        </Link>
      </div>
    </article>
  )
}
