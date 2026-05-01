'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { InsoundLogo } from '@/app/components/ui/InsoundLogo'
import { createClient } from '@/lib/supabase/client'
import { SOUNDS, type Sound } from '@/lib/sounds'

const MIN_GENRES = 3
const MAX_GENRES = 5

type OnboardingStep = 'profile' | 'genres' | 'done'

export function WelcomeClient({ hasProfile }: { hasProfile: boolean }) {
  const supabase = createClient()
  const router = useRouter()
  const [step, setStep] = useState<OnboardingStep>(hasProfile ? 'done' : 'profile')

  useEffect(() => {
    if (step !== 'done') return
    async function markSeen() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('fan_profiles').update({ has_seen_welcome: true }).eq('id', user.id)
      }
      if (hasProfile) {
        router.push('/explore')
      }
    }
    markSeen()
  }, [step, supabase, hasProfile, router])

  if (step === 'profile') {
    return <StepProfile onNext={() => setStep('genres')} onSkip={() => setStep('done')} />
  }

  if (step === 'genres') {
    return <StepGenres onNext={() => setStep('done')} onSkip={() => setStep('done')} />
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,109,0,0.05),transparent_60%)]" />

      <div className="w-full max-w-2xl relative z-10 text-center">
        <InsoundLogo size="xl" className="mb-6" />
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[0.92] mb-4">
          You&apos;re in.
        </h1>
        <p className="text-zinc-400 text-lg mb-16 max-w-md mx-auto">
          Start discovering independent music.
        </p>

        <Link
          href="/discover"

          className="block max-w-sm mx-auto bg-zinc-900 ring-1 ring-white/[0.06] rounded-3xl p-8 text-center hover:ring-white/[0.15] transition-all group"
        >
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-white/[0.04] flex items-center justify-center">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-zinc-400 group-hover:text-white transition-colors">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <p className="font-display font-bold text-lg mb-2 group-hover:text-white transition-colors">Discover music</p>
          <p className="text-zinc-500 text-sm">Browse, listen, and support artists directly.</p>
        </Link>

        <div className="mt-10 text-center">
          <Link
            href="/become-an-artist"
  
            className="inline-flex items-center gap-2 text-sm text-orange-500 hover:text-orange-400 transition-colors font-semibold"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Are you an artist? Start selling your music
          </Link>
        </div>
      </div>
    </div>
  )
}

function StepProfile({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [displayName, setDisplayName] = useState('')
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function handleFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = () => setAvatarDataUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBusy(false); return }

    const trimmed = displayName.trim()
    if (trimmed) {
      await supabase.from('fan_profiles').update({ username: trimmed }).eq('id', user.id)
    }

    if (avatarDataUrl) {
      try {
        const res = await fetch(avatarDataUrl)
        const blob = await res.blob()
        const ext = blob.type.split('/')[1] || 'jpg'
        const path = `${user.id}/avatar.${ext}`

        await supabase.storage.from('avatars').upload(path, blob, {
          contentType: blob.type,
          upsert: true,
        })

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        if (urlData?.publicUrl) {
          await supabase.from('fan_profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id)
        }
      } catch (err) {
        console.error('[onboarding] avatar upload failed:', err)
      }
    }

    setBusy(false)
    onNext()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,109,0,0.05),transparent_60%)]" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <InsoundLogo size="xl" />
          <p className="text-zinc-500 mt-2 font-medium text-sm">Almost there — personalise your profile.</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl" style={{ boxShadow: '0 0 60px rgba(245,109,0,0.08)' }}>
          <h2 className="font-display text-xl font-bold text-center mb-2">Set up your profile</h2>
          <p className="text-zinc-500 text-sm text-center mb-8">Optional — you can always do this later.</p>

          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            className="w-24 h-24 mx-auto mb-6 rounded-full border-2 border-dashed border-zinc-700 hover:border-orange-600 flex items-center justify-center cursor-pointer transition-colors overflow-hidden bg-zinc-950"
          >
            {avatarDataUrl ? (
              <img src={avatarDataUrl} alt="Avatar preview" className="w-full h-full object-cover" />
            ) : (
              <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-zinc-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m-4 4h8M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => handleFile(e.target.files?.[0])}
          />
          {avatarDataUrl && (
            <button type="button" onClick={() => setAvatarDataUrl(null)} className="block mx-auto text-xs text-zinc-500 hover:text-red-400 mb-4 transition-colors">
              Remove photo
            </button>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Display Name</label>
              <input
                type="text"
                placeholder="Your name or alias"
                autoFocus
                maxLength={50}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onSkip}
                className="flex-1 border border-zinc-700 text-zinc-400 font-bold py-3.5 rounded-xl hover:border-zinc-500 hover:text-white transition-colors text-sm"
              >
                Skip
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 bg-orange-600 text-black font-black py-3.5 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? 'Saving...' : 'Continue →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function StepGenres({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [selected, setSelected] = useState<Sound[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canSubmit = selected.length >= MIN_GENRES

  function toggle(genre: Sound) {
    setSelected(prev => {
      if (prev.includes(genre)) return prev.filter(g => g !== genre)
      if (prev.length >= MAX_GENRES) return prev
      return [...prev, genre]
    })
  }

  async function handleSave() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/fan-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genres: selected }),
      })
      if (!res.ok) throw new Error('Failed to save')
    } catch {
      setError('Something went wrong. Please try again.')
      setBusy(false)
      return
    }
    setBusy(false)
    onNext()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,109,0,0.05),transparent_60%)]" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <InsoundLogo size="xl" />
          <p className="text-zinc-500 mt-2 font-medium text-sm">One more thing.</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl" style={{ boxShadow: '0 0 60px rgba(245,109,0,0.08)' }}>
          <h2 className="font-display text-xl font-bold text-center mb-2">What do you listen to?</h2>
          <p className="text-zinc-500 text-sm text-center mb-6">
            Pick {MIN_GENRES}&ndash;{MAX_GENRES} genres to personalise your discover feed.
          </p>

          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {SOUNDS.map(genre => {
              const isSelected = selected.includes(genre)
              const atMax = selected.length >= MAX_GENRES && !isSelected
              return (
                <button
                  key={genre}
                  type="button"
                  disabled={atMax}
                  onClick={() => toggle(genre)}
                  className={`
                    relative px-3 py-3 rounded-xl font-display font-bold text-sm
                    transition-all duration-150 ease-out cursor-pointer border
                    ${isSelected
                      ? 'bg-orange-600/15 border-orange-600 text-orange-600 scale-[1.02]'
                      : 'bg-white/[0.03] border-white/[0.08] text-white hover:border-white/[0.2] hover:bg-white/[0.06]'
                    }
                    ${atMax ? 'opacity-40 cursor-not-allowed' : ''}
                  `}
                >
                  {genre}
                  {isSelected && (
                    <span className="absolute top-1.5 right-2 text-orange-600 text-xs">✓</span>
                  )}
                </button>
              )
            })}
          </div>

          <p className="text-xs text-zinc-500 text-center mb-5">
            {selected.length} of {MAX_GENRES} selected
            {selected.length > 0 && selected.length < MIN_GENRES && (
              <span className="text-zinc-600"> · pick {MIN_GENRES - selected.length} more</span>
            )}
          </p>

          {error && (
            <div role="alert" className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onSkip}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              I&apos;ll explore on my own
            </button>
            <button
              type="button"
              disabled={!canSubmit || busy}
              onClick={handleSave}
              className={`flex-1 py-3.5 rounded-xl font-black text-sm uppercase tracking-wider transition-all ${
                canSubmit
                  ? 'bg-orange-600 text-black hover:bg-orange-500'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              } disabled:opacity-60`}
            >
              {busy ? 'Saving...' : 'Continue →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
