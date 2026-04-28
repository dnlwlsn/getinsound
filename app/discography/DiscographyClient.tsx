'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatPrice as formatPriceUtil } from '@/app/lib/currency'
import { SoundTagSelector } from '@/app/components/ui/SoundTagSelector'
import { SOUNDS_SET } from '@/lib/sounds'

/* ── Types ─────────────────────────────────────────────────────── */

interface Track {
  id: string
  title: string
  position: number
  duration_sec: number | null
  audio_path: string
  preview_path: string | null
}

interface Release {
  id: string
  slug: string
  title: string
  type: string
  cover_url: string | null
  price_pence: number
  published: boolean
  pwyw_enabled: boolean
  pwyw_minimum_pence: number | null
  preorder_enabled: boolean
  release_date: string | null
  visibility: string
  created_at: string
  tracks: Track[]
}

interface Artist {
  id: string
  slug: string
  name: string
}

interface Props {
  artist: Artist
  stripeOnboarded: boolean
  releases: Release[]
}

/* ── Pending track (before save) ───────────────────────────────── */

interface PendingTrack {
  file: File
  title: string
  position: number
}

/* ── Helpers ───────────────────────────────────────────────────── */

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function pence(n: number) {
  return formatPriceUtil(n / 100, 'GBP')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ── Component ─────────────────────────────────────────────────── */

export function DiscographyClient({ artist, stripeOnboarded, releases: initialReleases }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/')
  }, [supabase, router])

  const [releases, setReleases] = useState(initialReleases)
  const [showModal, setShowModal] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  // ── Create release form state ──────────────────────────────
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [type, setType] = useState<'single' | 'ep' | 'album'>('album')
  const [pricePounds, setPricePounds] = useState('10.00')
  const [pwyw, setPwyw] = useState(false)
  const [pwywMinPounds, setPwywMinPounds] = useState('2.00')
  const [preorder, setPreorder] = useState(false)
  const [releaseDate, setReleaseDate] = useState('')
  const [soundTags, setSoundTags] = useState<string[]>([])
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [pendingTracks, setPendingTracks] = useState<PendingTrack[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState('')

  const coverInputRef = useRef<HTMLInputElement>(null)
  const trackInputRef = useRef<HTMLInputElement>(null)

  function openModal() {
    setTitle('')
    setSlug('')
    setSlugTouched(false)
    setType('album')
    setPricePounds('10.00')
    setPwyw(false)
    setPwywMinPounds('3.00')
    setPreorder(false)
    setReleaseDate('')
    setSoundTags([])
    setCoverFile(null)
    setCoverPreview(null)
    setPendingTracks([])
    setError('')
    setUploadProgress('')
    setShowModal(true)
  }

  function handleTitleChange(v: string) {
    setTitle(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    const url = URL.createObjectURL(file)
    setCoverPreview(url)
  }

  function handleTrackFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const existing = pendingTracks.length
    const newTracks: PendingTrack[] = files.map((f, i) => ({
      file: f,
      title: f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
      position: existing + i + 1,
    }))
    setPendingTracks(prev => [...prev, ...newTracks])
    e.target.value = ''
  }

  function removeTrack(index: number) {
    setPendingTracks(prev => {
      const next = prev.filter((_, i) => i !== index)
      return next.map((t, i) => ({ ...t, position: i + 1 }))
    })
  }

  function moveTrack(index: number, direction: -1 | 1) {
    setPendingTracks(prev => {
      const next = [...prev]
      const swapIdx = index + direction
      if (swapIdx < 0 || swapIdx >= next.length) return prev
      ;[next[index], next[swapIdx]] = [next[swapIdx], next[index]]
      return next.map((t, i) => ({ ...t, position: i + 1 }))
    })
  }

  function updateTrackTitle(index: number, newTitle: string) {
    setPendingTracks(prev => prev.map((t, i) => i === index ? { ...t, title: newTitle } : t))
  }

  // ── Save ────────────────────────────────────────────────────
  const handleSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmedSlug = slug.trim().toLowerCase()
    if (!/^[a-z0-9][a-z0-9-]{0,60}[a-z0-9]$/.test(trimmedSlug)) {
      setError('Slug must be 2-62 characters: lowercase letters, numbers, hyphens.')
      return
    }

    const pricePence = Math.round(parseFloat(pricePounds) * 100)
    if (isNaN(pricePence) || pricePence < 300) {
      setError(`Minimum price is ${formatPriceUtil(3, 'GBP')}.`)
      return
    }

    if (pwyw) {
      const pwywMinPence = Math.round(parseFloat(pwywMinPounds) * 100)
      if (isNaN(pwywMinPence) || pwywMinPence < 300) {
        setError(`PWYW minimum must be at least ${formatPriceUtil(3, 'GBP')}.`)
        return
      }
    }

    if (pendingTracks.length === 0) {
      setError('Add at least one track.')
      return
    }

    if (preorder && !releaseDate) {
      setError('Set a release date for pre-orders.')
      return
    }

    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Your session has expired. Please refresh the page and sign in again.')
        setSaving(false)
        return
      }

      // 1. Create the release row
      setUploadProgress('Creating release...')
      const pwywMinPence = pwyw ? Math.round(parseFloat(pwywMinPounds) * 100) : null
      const { data: release, error: relErr } = await supabase
        .from('releases')
        .insert({
          artist_id: artist.id,
          slug: trimmedSlug,
          title: title.trim(),
          type,
          price_pence: pricePence,
          pwyw_enabled: pwyw,
          pwyw_minimum_pence: pwywMinPence,
          preorder_enabled: preorder,
          release_date: preorder && releaseDate ? releaseDate : null,
        })
        .select('id')
        .single()

      if (relErr) throw new Error(relErr.message)

      // 1b. Save sound tags
      if (soundTags.length > 0) {
        const { error: tagErr } = await supabase
          .from('release_tags')
          .insert(soundTags.map(tag => ({
            release_id: release.id,
            tag: tag.toLowerCase().trim(),
            is_custom: !SOUNDS_SET.has(tag),
          })))
        if (tagErr) throw new Error(tagErr.message)
      }

      // 2. Upload cover art
      if (coverFile) {
        setUploadProgress('Uploading cover art...')
        const ext = coverFile.name.split('.').pop() || 'jpg'
        const coverPath = `${artist.id}/${release.id}.${ext}`
        const { error: coverErr } = await supabase.storage
          .from('covers')
          .upload(coverPath, coverFile, { contentType: coverFile.type, upsert: true })
        if (!coverErr) {
          const { data: publicUrl } = supabase.storage.from('covers').getPublicUrl(coverPath)
          await supabase.from('releases').update({ cover_url: publicUrl.publicUrl }).eq('id', release.id)
        }
      }

      // 3. Upload tracks
      for (let i = 0; i < pendingTracks.length; i++) {
        const pt = pendingTracks[i]
        setUploadProgress(`Uploading track ${i + 1} of ${pendingTracks.length}...`)

        const ext = pt.file.name.split('.').pop() || 'mp3'
        const audioPath = `${artist.id}/${release.id}-${pt.position}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('masters')
          .upload(audioPath, pt.file, { contentType: pt.file.type })

        if (uploadErr) throw new Error(`Failed to upload "${pt.title}": ${uploadErr.message}`)

        const { error: trackErr } = await supabase
          .from('tracks')
          .insert({
            release_id: release.id,
            position: pt.position,
            title: pt.title.trim(),
            audio_path: audioPath,
          })

        if (trackErr) throw new Error(`Failed to save track "${pt.title}": ${trackErr.message}`)
      }

      setUploadProgress('Done!')
      setShowModal(false)

      // If no cover was uploaded, the Edge Function generates one async.
      // Wait a moment for it to finish.
      if (!coverFile) {
        await new Promise(r => setTimeout(r, 3000))
      }

      // Re-fetch releases client-side so the list updates immediately
      const { data: fresh } = await supabase
        .from('releases')
        .select('id, slug, title, type, cover_url, price_pence, published, pwyw_enabled, pwyw_minimum_pence, preorder_enabled, release_date, visibility, created_at, tracks(id, title, position, duration_sec, audio_path, preview_path)')
        .eq('artist_id', artist.id)
        .order('created_at', { ascending: false })

      if (fresh) {
        setReleases(fresh.map(r => ({
          ...r,
          tracks: [...(r.tracks || [])].sort((a, b) => a.position - b.position),
        })))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We couldn\'t save your release - please try again.')
      setSaving(false)
    }
  }, [artist.id, slug, title, type, pricePounds, pwyw, pwywMinPounds, preorder, releaseDate, soundTags, coverFile, pendingTracks, supabase, router])

  // ── Toggle publish ──────────────────────────────────────────
  async function togglePublish(releaseId: string, current: boolean) {
    setPublishError(null)
    const res = await fetch('/api/releases/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ release_id: releaseId, published: !current }),
    })
    if (res.ok) {
      setReleases(prev => prev.map(r => r.id === releaseId ? { ...r, published: !current } : r))
    } else {
      const body = await res.json().catch(() => ({}))
      setPublishError(body.error || 'Failed to update publish status.')
    }
  }

  // ── Delete release ─────────────────────────────────────────
  async function deleteRelease(release: Release) {
    if (!confirm(`Delete "${release.title}"? This cannot be undone.`)) return

    // Delete storage files first
    const trackPaths = release.tracks.map(t => t.audio_path)
    if (trackPaths.length > 0) {
      await supabase.storage.from('masters').remove(trackPaths)
    }
    const previewPaths = release.tracks.map(t => t.preview_path).filter(Boolean) as string[]
    if (previewPaths.length > 0) {
      await supabase.storage.from('previews').remove(previewPaths)
    }
    if (release.cover_url) {
      const coverKey = `${artist.id}/${release.id}`
      await supabase.storage.from('covers').remove([`${coverKey}.jpg`, `${coverKey}.png`, `${coverKey}.webp`, `${coverKey}-generated.svg`])
    }

    const { error } = await supabase.from('releases').delete().eq('id', release.id)
    if (!error) setReleases(prev => prev.filter(r => r.id !== release.id))
  }

  // ── Stats ───────────────────────────────────────────────────
  const liveCount = releases.filter(r => r.published).length
  const totalTracks = releases.reduce((s, r) => s + r.tracks.length, 0)

  return (
    <div className="min-h-screen flex font-display text-zinc-100 bg-insound-bg">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-900 p-8 hidden md:flex flex-col flex-shrink-0 sticky top-0 h-screen">
        <Link href="/" className="text-2xl font-black text-orange-600 tracking-tighter mb-12 block hover:text-orange-500 transition-colors">insound.</Link>
        <nav className="space-y-1 flex-1">
          <SidebarLink href="/dashboard" label="Dashboard" icon="grid" />
          <SidebarLink href="/discography" label="Discography" icon="music" active />
          <SidebarLink href="/sales" label="Sales & Payouts" icon="dollar" />
          <SidebarLink href="/library" label="My Collection" icon="music" />
          <SidebarLink href="/explore" label="Explore" icon="search" />
        </nav>
        <div className="pt-6 border-t border-zinc-900">
          <button onClick={handleLogout} className="flex items-center gap-3 p-3.5 text-zinc-600 hover:text-red-400 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors w-full">
            Log Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto p-8 md:p-12">

          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
            <div>
              <h1 className="text-4xl font-black tracking-tight">Discography</h1>
              <p className="text-zinc-500 text-sm mt-1">{releases.length} release{releases.length === 1 ? '' : 's'} · {liveCount} live · {totalTracks} track{totalTracks === 1 ? '' : 's'}</p>
            </div>
            <button
              onClick={openModal}
              className="bg-orange-600 text-black font-black px-6 py-3 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider flex items-center gap-2 flex-shrink-0"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              New Release
            </button>
          </header>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Releases" value={String(releases.length)} />
            <StatCard label="Live" value={String(liveCount)} color="text-green-500" />
            <StatCard label="Drafts" value={String(releases.length - liveCount)} />
            <StatCard label="Tracks" value={String(totalTracks)} />
          </div>

          {!stripeOnboarded && (
            <div className="bg-orange-600/10 border border-orange-600/30 rounded-2xl px-5 py-4 mb-4 flex items-start gap-3">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="shrink-0 mt-0.5 text-orange-600"><path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div>
                <p className="text-sm font-bold text-orange-500">Connect Stripe to publish</p>
                <p className="text-xs text-zinc-400 mt-0.5">You can upload and prepare releases, but you&apos;ll need to connect your Stripe account before publishing. <Link href="/dashboard" className="text-orange-500 underline hover:text-orange-400">Go to Dashboard → Stripe Connect</Link></p>
              </div>
            </div>
          )}

          {publishError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-3 mb-4">
              <p className="text-sm font-bold text-red-400">{publishError}</p>
            </div>
          )}

          {/* Releases table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-zinc-800/60 text-zinc-500 text-[10px] uppercase font-black tracking-widest border-b border-zinc-800">
                <tr>
                  <th className="p-5 pl-6">#</th>
                  <th className="p-5">Release</th>
                  <th className="p-5 hidden md:table-cell">Status</th>
                  <th className="p-5 hidden md:table-cell">Price</th>
                  <th className="p-5 hidden lg:table-cell">Tracks</th>
                  <th className="p-5 hidden lg:table-cell">Created</th>
                  <th className="p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {releases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-zinc-600 font-bold text-sm">
                      No releases yet. Click &quot;New Release&quot; to get started.
                    </td>
                  </tr>
                ) : (
                  releases.map((r, i) => (
                    <tr key={r.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="p-5 pl-6 text-zinc-600 font-mono text-xs">{String(i + 1).padStart(2, '0')}</td>
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                            {r.cover_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.cover_url} alt={`${r.title} cover art`} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{r.title}</p>
                            <p className="text-zinc-500 text-xs capitalize">{r.type}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-5 hidden md:table-cell">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${r.published ? 'text-green-500 border-green-500/30 bg-green-500/10' : 'text-zinc-500 border-zinc-700 bg-zinc-800'}`}>
                          {r.published ? 'Live' : 'Draft'}
                        </span>
                      </td>
                      <td className="p-5 hidden md:table-cell text-sm">
                        {r.pwyw_enabled
                          ? <span className="text-orange-500">from {pence(r.pwyw_minimum_pence ?? r.price_pence)}</span>
                          : pence(r.price_pence)
                        }
                      </td>
                      <td className="p-5 hidden lg:table-cell text-zinc-400 text-sm">{r.tracks.length}</td>
                      <td className="p-5 hidden lg:table-cell text-zinc-500 text-xs">{formatDate(r.created_at)}</td>
                      <td className="p-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => togglePublish(r.id, r.published)}
                            className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors ${r.published ? 'text-zinc-400 hover:text-red-400 hover:bg-red-500/10' : 'text-orange-500 hover:bg-orange-500/10'}`}
                          >
                            {r.published ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            onClick={() => deleteRelease(r)}
                            className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete release"
                          >
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/95 border-t border-zinc-900 backdrop-blur-md z-50 flex">
        <MobileNavLink href="/dashboard" label="Home" icon="grid" />
        <MobileNavLink href="/discography" label="Music" icon="music" active />
        <MobileNavLink href="/sales" label="Sales" icon="dollar" />
        <MobileNavLink href="/explore" label="Store" icon="search" />
      </nav>

      {/* ── Create Release Modal ───────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-[400] bg-black/85 backdrop-blur-md overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget && !saving) setShowModal(false) }}>
          <div className="min-h-screen flex items-start md:items-center justify-center p-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl relative my-8 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                <h2 className="text-xl font-black font-display">New Release</h2>
                {!saving && (
                  <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-5">
                {/* Title */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="My New Release"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm text-white placeholder-zinc-700 focus:border-orange-600 outline-none transition-colors"
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">URL Slug</label>
                  <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl px-4 focus-within:border-orange-600 transition-colors">
                    <span className="text-zinc-600 text-sm select-none shrink-0">/release?r=</span>
                    <input
                      type="text"
                      required
                      value={slug}
                      onChange={(e) => { setSlugTouched(true); setSlug(e.target.value) }}
                      className="flex-1 bg-transparent py-3 outline-none text-white text-sm placeholder-zinc-700"
                    />
                  </div>
                </div>

                {/* Type */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Type</label>
                  <div className="flex gap-2">
                    {(['album', 'ep', 'single'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setType(t)
                          if (t === 'album' && (pricePounds === '3.00' || pricePounds === '5.00')) setPricePounds('10.00')
                          if (t === 'ep' && (pricePounds === '3.00' || pricePounds === '10.00')) setPricePounds('5.00')
                          if (t === 'single' && (pricePounds === '10.00' || pricePounds === '5.00')) setPricePounds('3.00')
                        }}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold capitalize transition-colors ${type === t ? 'bg-orange-600 text-black' : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'}`}
                      >
                        {t === 'ep' ? 'EP' : t}
                      </button>
                    ))}
                  </div>
                  {type === 'single' && (
                    <p className="text-[10px] text-zinc-500 mt-1.5">Got more tracks? Albums and EPs tend to earn more per release.</p>
                  )}
                </div>

                {/* Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Price (GBP)</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPricePounds(p => { const v = Math.max(2, parseFloat(p) - 1); return v.toFixed(2) })}
                        className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors flex items-center justify-center text-lg font-bold"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        step="0.01"
                        min="3.00"
                        required
                        value={pricePounds}
                        onChange={(e) => setPricePounds(e.target.value)}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm text-white text-center focus:border-orange-600 outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setPricePounds(p => { const v = parseFloat(p) + 1; return v.toFixed(2) })}
                        className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors flex items-center justify-center text-lg font-bold"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-1.5">
                      {pwyw ? 'Suggested price shown to fans.' : 'Fixed price fans pay to download.'} Min {formatPriceUtil(3, 'GBP')}.
                      {type === 'album' && ' Most albums sell between £5–£10.'}
                      {type === 'ep' && ' Most EPs sell between £3–£6.'}
                    </p>
                  </div>
                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-3 cursor-pointer py-3">
                      <input type="checkbox" checked={pwyw} onChange={(e) => setPwyw(e.target.checked)} className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-orange-600 focus:ring-orange-600 focus:ring-offset-0" />
                      <span className="text-sm text-zinc-400 font-bold">Pay what you want</span>
                    </label>
                    <p className="text-[10px] text-zinc-600">Let fans choose how much to pay.</p>
                  </div>
                </div>

                {pwyw && (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Minimum price (GBP)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="3.00"
                      value={pwywMinPounds}
                      onChange={(e) => setPwywMinPounds(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm text-white focus:border-orange-600 outline-none transition-colors"
                    />
                    <p className="text-[10px] text-zinc-600 mt-1.5">The lowest amount a fan can pay. They can always pay more.</p>
                  </div>
                )}

                {/* Pre-order */}
                <div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={preorder} onChange={(e) => setPreorder(e.target.checked)} className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-orange-600 focus:ring-orange-600 focus:ring-offset-0" />
                      <span className="text-sm text-zinc-400 font-bold">Pre-order</span>
                    </label>
                    {preorder && (
                      <input
                        type="date"
                        value={releaseDate}
                        onChange={(e) => setReleaseDate(e.target.value)}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-sm text-white focus:border-orange-600 outline-none transition-colors"
                      />
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1.5">{preorder ? 'Fans can buy now and download on release day.' : 'Let fans buy before the release date.'}</p>
                </div>

                {/* Sound tags */}
                <SoundTagSelector selected={soundTags} onChange={setSoundTags} />

                {/* Cover art */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Cover Art <span className="text-zinc-700 normal-case tracking-normal font-bold">(optional)</span></label>
                  <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" />
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="w-full flex items-center gap-4 bg-zinc-900 border border-zinc-800 border-dashed rounded-xl p-4 hover:border-zinc-600 transition-colors"
                  >
                    {coverPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverPreview} alt="Cover preview" className="w-16 h-16 rounded-lg object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-600">
                        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                    )}
                    <div className="text-left">
                      <p className="text-sm font-bold text-zinc-300">{coverFile ? coverFile.name : 'Upload artwork'}</p>
                      <p className="text-xs text-zinc-600">Square image recommended</p>
                    </div>
                  </button>
                  <p className="text-[10px] text-zinc-600 mt-1.5">If you skip this, we&apos;ll generate unique gradient artwork automatically.</p>
                </div>

                {/* Tracks */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tracks</label>
                    <input ref={trackInputRef} type="file" accept="audio/*" multiple onChange={handleTrackFiles} className="hidden" />
                    <button
                      type="button"
                      onClick={() => trackInputRef.current?.click()}
                      className="text-[10px] font-black uppercase tracking-widest text-orange-500 hover:text-orange-400 transition-colors"
                    >
                      + Add Files
                    </button>
                  </div>

                  {pendingTracks.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => trackInputRef.current?.click()}
                      className="w-full bg-zinc-900 border border-zinc-800 border-dashed rounded-xl p-8 text-center hover:border-zinc-600 transition-colors"
                    >
                      <svg className="mx-auto mb-2 text-zinc-600" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z" /></svg>
                      <p className="text-sm text-zinc-500 font-bold">Drop audio files or click to browse</p>
                      <p className="text-xs text-zinc-600 mt-1">MP3, WAV, FLAC, AAC</p>
                    </button>
                  ) : (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800/60">
                      {pendingTracks.map((pt, i) => (
                        <div key={i} className="flex items-center gap-3 p-3">
                          <span className="text-zinc-600 font-mono text-xs w-6 text-center shrink-0">{String(pt.position).padStart(2, '0')}</span>
                          <input
                            type="text"
                            value={pt.title}
                            onChange={(e) => updateTrackTitle(i, e.target.value)}
                            className="flex-1 bg-transparent text-sm text-white outline-none min-w-0"
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            <button type="button" onClick={() => moveTrack(i, -1)} disabled={i === 0} className="w-6 h-6 rounded text-zinc-600 hover:text-white disabled:opacity-30 transition-colors">
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="mx-auto"><path d="M18 15l-6-6-6 6" /></svg>
                            </button>
                            <button type="button" onClick={() => moveTrack(i, 1)} disabled={i === pendingTracks.length - 1} className="w-6 h-6 rounded text-zinc-600 hover:text-white disabled:opacity-30 transition-colors">
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="mx-auto"><path d="M6 9l6 6 6-6" /></svg>
                            </button>
                            <button type="button" onClick={() => removeTrack(i)} className="w-6 h-6 rounded text-zinc-600 hover:text-red-400 transition-colors">
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="mx-auto"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-3">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                      {uploadProgress}
                    </>
                  ) : (
                    'Create Release'
                  )}
                </button>

                <p className="text-center text-[10px] text-zinc-600">
                  Your release will be saved as a draft. Publish it when you&apos;re ready.
                </p>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ────────────────────────────────────────────── */

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{label}</p>
      <p className={`text-2xl font-black ${color || ''}`}>{value}</p>
    </div>
  )
}

const ICONS: Record<string, JSX.Element> = {
  grid: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
  music: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z" /></svg>,
  dollar: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>,
  search: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>,
}

function SidebarLink({ href, label, icon, active }: { href: string; label: string; icon: string; active?: boolean }) {
  return (
    <Link href={href} className={`flex items-center gap-3 p-3.5 font-bold rounded-xl text-sm transition-all ${active ? 'bg-orange-600/10 text-orange-500' : 'text-zinc-500 hover:bg-orange-600/[0.06] hover:text-white'}`}>
      {ICONS[icon]}
      {label}
    </Link>
  )
}

function MobileNavLink({ href, label, icon, active }: { href: string; label: string; icon: string; active?: boolean }) {
  return (
    <Link href={href} className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${active ? 'text-orange-500' : 'text-zinc-500 hover:text-white'}`}>
      {ICONS[icon] && <span className="[&>svg]:w-5 [&>svg]:h-5">{ICONS[icon]}</span>}
      <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
    </Link>
  )
}
