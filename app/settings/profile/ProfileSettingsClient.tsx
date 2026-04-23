'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { resolveAccent, DEFAULT_ACCENT } from '@/lib/accent'
import { SettingsTabs } from '@/components/settings/SettingsTabs'
import { NotificationBell } from '@/app/components/ui/NotificationBell'
import { ImageUploader } from '@/app/components/ui/ImageUploader'

const ACCENT_COLOURS = [
  '#ea580c', '#dc2626', '#db2777', '#9333ea', '#7c3aed',
  '#4f46e5', '#2563eb', '#0891b2', '#059669', '#16a34a',
  '#65a30d', '#ca8a04', '#d97706', '#78716c', '#ffffff',
]

interface SettingsPurchase {
  id: string
  amount_pence: number
  paid_at: string
  releases: { title: string; type: string }
  artists: { name: string }
}

interface ProfileData {
  username: string | null
  avatar_url: string | null
  bio: string | null
  accent_colour: string | null
  is_public: boolean
  show_purchase_amounts: boolean
  show_collection: boolean
  show_wall: boolean
}

export function ProfileSettingsClient({ profile, purchases, hiddenPurchaseIds, userId }: {
  profile: ProfileData
  purchases: SettingsPurchase[]
  hiddenPurchaseIds: string[]
  userId: string
}) {
  const supabase = createClient()

  const [username, setUsername] = useState(profile.username || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [accent, setAccent] = useState(profile.accent_colour || DEFAULT_ACCENT)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [isPublic, setIsPublic] = useState(profile.is_public)
  const [showAmounts, setShowAmounts] = useState(profile.show_purchase_amounts)
  const [showCollection, setShowCollection] = useState(profile.show_collection)
  const [showWall, setShowWall] = useState(profile.show_wall)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set(hiddenPurchaseIds))

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const resolvedAccent = resolveAccent(accent)

  async function handleAvatarUpload(file: File) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Delete previous avatar files
    const { data: existing } = await supabase.storage.from('avatars').list(user.id)
    if (existing?.length) {
      await supabase.storage.from('avatars').remove(existing.map(f => `${user.id}/${f.name}`))
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${user.id}/avatar.${ext}`
    const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadErr) throw new Error(uploadErr.message)

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    setAvatarUrl(`${publicUrl}?t=${Date.now()}`)
  }

  async function handleAvatarRemove() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: existing } = await supabase.storage.from('avatars').list(user.id)
    if (existing?.length) {
      await supabase.storage.from('avatars').remove(existing.map(f => `${user.id}/${f.name}`))
    }
    setAvatarUrl(null)
  }

  async function toggleHidePurchase(purchaseId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (hiddenIds.has(purchaseId)) {
      await supabase.from('fan_hidden_purchases')
        .delete().eq('user_id', user.id).eq('purchase_id', purchaseId)
      setHiddenIds(prev => { const next = new Set(prev); next.delete(purchaseId); return next })
    } else {
      await supabase.from('fan_hidden_purchases')
        .insert({ user_id: user.id, purchase_id: purchaseId })
      setHiddenIds(prev => new Set(prev).add(purchaseId))
    }
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess(false)

    const trimmedUsername = username.toLowerCase().trim()
      .replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

    if (trimmedUsername && !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(trimmedUsername)) {
      setError('Username must be 3-40 characters: lowercase letters, numbers, hyphens.')
      setSaving(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setSaving(false); return }

    if (trimmedUsername) {
      const { data: existingFan } = await supabase
        .from('fan_profiles').select('id').eq('username', trimmedUsername).maybeSingle()
      if (existingFan && existingFan.id !== user.id) {
        setError(`"${trimmedUsername}" is already taken.`)
        setSaving(false)
        return
      }
    }

    const { error: updateErr } = await supabase
      .from('fan_profiles')
      .update({
        username: trimmedUsername || null,
        bio: bio.trim() || null,
        accent_colour: accent,
        avatar_url: avatarUrl,
        is_public: isPublic,
        show_purchase_amounts: showAmounts,
        show_collection: showCollection,
        show_wall: showWall,
      })
      .eq('id', user.id)

    if (updateErr) {
      setError(updateErr.message)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen flex flex-col relative"
      style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)', backgroundSize: '48px 48px' }}>

      {/* Nav */}
      <nav className="sticky top-0 w-full z-50 flex justify-between items-center px-6 md:px-14 py-5 border-b border-zinc-900/80"
        style={{ background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <Link href="/" className="text-2xl font-black tracking-tighter hover:text-orange-500 transition-colors font-display"
          style={{ color: resolvedAccent }}>
          insound.
        </Link>
        <div className="flex gap-4 items-center">
          {username && (
            <Link href={`/@${username}`}
              className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
              View Profile
            </Link>
          )}
          <NotificationBell userId={userId} />
        </div>
      </nav>

      <div className="flex-1 flex items-start justify-center p-6 pt-12 relative">
        <div className="w-full max-w-lg relative z-10">
          <h1 className="font-display text-2xl font-bold mb-2">Settings</h1>
          <p className="text-zinc-500 text-sm mb-6">Manage your account.</p>

          <SettingsTabs />

          <div className="space-y-8">

            {/* ── Avatar ─────────────────────────────────────── */}
            <ImageUploader
              currentUrl={avatarUrl}
              onUpload={handleAvatarUpload}
              onRemove={handleAvatarRemove}
              aspect={1}
              maxSizeMB={2}
              accept="image/jpeg,image/png,image/webp,image/gif"
              label="Avatar"
              variant="avatar"
              accent={resolvedAccent}
              fallback={
                <div className="w-full h-full rounded-full flex items-center justify-center text-xl font-bold"
                  style={{ background: `${resolvedAccent}22`, color: resolvedAccent }}>
                  {username?.[0]?.toUpperCase() || '?'}
                </div>
              }
            />

            {/* ── Username ───────────────────────────────────── */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Username</label>
              <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-4 focus-within:border-orange-600 transition-colors">
                <span className="text-zinc-600 text-sm select-none">getinsound.com/@</span>
                <input type="text" placeholder="your-name" value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="flex-1 bg-transparent py-3.5 outline-none text-white text-sm placeholder-zinc-700" />
              </div>
              <p className="text-[10px] text-zinc-600 mt-1.5">Lowercase letters, numbers and hyphens. 3-40 characters.</p>
            </div>

            {/* ── Bio ────────────────────────────────────────── */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">
                Bio <span className="text-zinc-700">({280 - bio.length} remaining)</span>
              </label>
              <textarea placeholder="What kind of music do you love?" rows={3} maxLength={280}
                value={bio} onChange={e => setBio(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600 resize-none" />
            </div>

            {/* ── Accent Colour ──────────────────────────────── */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-3">Accent Colour</label>
              <div className="grid grid-cols-5 gap-3 max-w-xs">
                {ACCENT_COLOURS.map(c => (
                  <button key={c} onClick={() => setAccent(c)}
                    className={`w-full aspect-square rounded-xl transition-all ${accent === c ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110' : 'hover:scale-105'}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>

            {/* ── Privacy ────────────────────────────────────── */}
            <div className="border-t border-zinc-800 pt-8">
              <h2 className="font-display text-lg font-bold mb-4">Privacy</h2>

              {username && (
                <a
                  href={`/@${username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-6 transition-colors"
                  style={{ color: resolvedAccent }}
                >
                  Preview my public profile
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                  </svg>
                </a>
              )}

              <label className="flex items-center justify-between py-4 cursor-pointer group">
                <div>
                  <p className="text-sm font-bold group-hover:text-white transition-colors">Make profile public</p>
                  <p className="text-xs text-zinc-600 mt-1">Your collection will be visible at getinsound.com/@{username || 'your-name'}</p>
                </div>
                <button onClick={() => setIsPublic(!isPublic)}
                  className={`w-12 h-7 rounded-full transition-colors relative ${isPublic ? '' : 'bg-zinc-700'}`}
                  style={isPublic ? { background: resolvedAccent } : {}}>
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${isPublic ? 'left-6' : 'left-1'}`} />
                </button>
              </label>

              <label className="flex items-center justify-between py-4 cursor-pointer group border-t border-zinc-900">
                <div>
                  <p className="text-sm font-bold group-hover:text-white transition-colors">Show purchase amounts</p>
                  <p className="text-xs text-zinc-600 mt-1">Display how much you paid for each release</p>
                </div>
                <button onClick={() => setShowAmounts(!showAmounts)}
                  className={`w-12 h-7 rounded-full transition-colors relative ${showAmounts ? '' : 'bg-zinc-700'}`}
                  style={showAmounts ? { background: resolvedAccent } : {}}>
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${showAmounts ? 'left-6' : 'left-1'}`} />
                </button>
              </label>

              <label className="flex items-center justify-between py-4 cursor-pointer group border-t border-zinc-900">
                <div>
                  <p className="text-sm font-bold group-hover:text-white transition-colors">Show collection</p>
                  <p className="text-xs text-zinc-600 mt-1">Display your full music collection on your public profile</p>
                </div>
                <button onClick={() => setShowCollection(!showCollection)}
                  className={`w-12 h-7 rounded-full transition-colors relative ${showCollection ? '' : 'bg-zinc-700'}`}
                  style={showCollection ? { background: resolvedAccent } : {}}>
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${showCollection ? 'left-6' : 'left-1'}`} />
                </button>
              </label>

              <label className="flex items-center justify-between py-4 cursor-pointer group border-t border-zinc-900">
                <div>
                  <p className="text-sm font-bold group-hover:text-white transition-colors">Show The Wall</p>
                  <p className="text-xs text-zinc-600 mt-1">Display artist updates on your public profile</p>
                </div>
                <button onClick={() => setShowWall(!showWall)}
                  className={`w-12 h-7 rounded-full transition-colors relative ${showWall ? '' : 'bg-zinc-700'}`}
                  style={showWall ? { background: resolvedAccent } : {}}>
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${showWall ? 'left-6' : 'left-1'}`} />
                </button>
              </label>
            </div>

            {/* ── Hide Specific Purchases ────────────────────── */}
            {purchases.length > 0 && (
              <div className="border-t border-zinc-800 pt-8">
                <h2 className="font-display text-lg font-bold mb-2">Collection Privacy</h2>
                <p className="text-xs text-zinc-500 mb-6">Hide specific purchases from your public profile.</p>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {purchases.map(p => {
                    const isHidden = hiddenIds.has(p.id)
                    return (
                      <div key={p.id}
                        className={`flex items-center justify-between py-3 px-4 rounded-xl transition-colors ${isHidden ? 'bg-zinc-900/50 opacity-60' : 'hover:bg-white/[0.02]'}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">{(p.releases as any).title}</p>
                          <p className="text-xs text-zinc-500">{(p.artists as any).name}</p>
                        </div>
                        <button onClick={() => toggleHidePurchase(p.id)}
                          className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors shrink-0 ml-3"
                          style={isHidden
                            ? { background: `${resolvedAccent}22`, color: resolvedAccent }
                            : { background: 'transparent', color: '#71717a', border: '1px solid #27272a' }
                          }>
                          {isHidden ? 'Show' : 'Hide'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Save + Status ──────────────────────────────── */}
            {error && (
              <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {success && (
              <div className="text-xs text-green-400 bg-green-950/40 border border-green-900/60 rounded-lg px-4 py-3">
                Settings saved.
              </div>
            )}

            <button onClick={handleSave} disabled={saving}
              className="w-full font-black py-4 rounded-xl transition-colors text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: resolvedAccent, color: '#000' }}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
