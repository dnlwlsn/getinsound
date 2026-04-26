'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { RESERVED_SLUGS } from '@/lib/reserved-slugs'

const ACCENT_COLOURS = [
  '#ea580c', '#dc2626', '#db2777', '#9333ea', '#7c3aed',
  '#4f46e5', '#2563eb', '#0891b2', '#059669', '#16a34a',
  '#65a30d', '#ca8a04', '#d97706', '#78716c', '#ffffff',
]

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function BecomeArtistClient({ userEmail }: { userEmail: string }) {
  const router = useRouter()
  const supabase = createClient()

  const [artistName, setArtistName] = useState('')
  const [slug, setSlug] = useState('')
  const slugTouched = useRef(false)

  const [attest, setAttest] = useState(false)
  const [terms, setTerms] = useState(false)

  const [accent, setAccent] = useState('#ea580c')

  const [bio, setBio] = useState('')

  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function handleArtistNameChange(value: string) {
    setArtistName(value)
    if (!slugTouched.current) setSlug(slugify(value))
  }

  function handleSlugChange(value: string) {
    slugTouched.current = true
    setSlug(value)
  }

  async function handleComplete() {
    const trimmedSlug = slug.trim().toLowerCase()

    if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(trimmedSlug)) {
      setError('URL must be 3-40 characters: lowercase letters, numbers, hyphens.')
      setStep(1)
      return
    }
    if (RESERVED_SLUGS.has(trimmedSlug)) {
      setError(`"${trimmedSlug}" is reserved. Try another.`)
      setStep(1)
      return
    }
    if (!attest || !terms) {
      setError('Please confirm both checkboxes.')
      setStep(2)
      return
    }

    setBusy(true)
    setError('')

    try {
      const { data: existing } = await supabase
        .from('artists')
        .select('id')
        .eq('slug', trimmedSlug)
        .maybeSingle()

      if (existing) {
        setError(`"${trimmedSlug}" is already taken. Try another.`)
        setStep(1)
        setBusy(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error: artistErr } = await supabase
        .from('artists')
        .insert({
          id: user.id,
          slug: trimmedSlug,
          name: artistName.trim(),
          bio: bio.trim() || null,
          accent_colour: accent,
        })
      if (artistErr) throw artistErr

      const { error: accountErr } = await supabase
        .from('artist_accounts')
        .insert({
          id: user.id,
          email: userEmail,
          self_attest_independent: true,
          independence_confirmed: true,
          independence_confirmed_at: new Date().toISOString(),
        })
      if (accountErr) throw accountErr

      await supabase
        .from('fan_profiles')
        .update({ has_seen_welcome: true })
        .eq('id', user.id)

      // Award founding_artist badge if eligible (waitlist position ≤ 50)
      try {
        const res = await fetch('/api/badges/founding-artist', { method: 'POST' })
        if (!res.ok) { /* badge check failed, non-critical */ }
      } catch {}

      router.push('/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setError(message)
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)', backgroundSize: '48px 48px' }}>
      <nav className="sticky top-0 w-full z-50 flex justify-between items-center px-6 md:px-14 py-5 border-b border-zinc-900/80" style={{ background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <Link href="/" className="text-2xl font-black text-orange-600 tracking-tighter hover:text-orange-500 transition-colors font-display">
          insound.
        </Link>
        <Link href="/explore" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
          Skip for now
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(234,88,12,0.05),transparent_60%)]" />

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-bold mb-2">Become an artist</h1>
            <p className="text-zinc-500 text-sm">Step {step} of 4</p>
          </div>

          <div className="flex gap-1 mb-8">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-orange-600' : 'bg-zinc-800'}`} />
            ))}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl" style={{ boxShadow: '0 0 60px rgba(234,88,12,0.08)' }}>

            {error && (
              <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-3 mb-5">
                {error}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Artist Name</label>
                  <input
                    type="text"
                    placeholder="Band or stage name"
                    required
                    value={artistName}
                    onChange={e => handleArtistNameChange(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Your URL</label>
                  <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-4 focus-within:border-orange-600 transition-colors">
                    <span className="text-zinc-600 text-sm select-none">getinsound.com/</span>
                    <input
                      type="text"
                      placeholder="your-name"
                      required
                      value={slug}
                      onChange={e => handleSlugChange(e.target.value)}
                      className="flex-1 bg-transparent py-3.5 outline-none text-white text-sm placeholder-zinc-700"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1.5">Lowercase letters, numbers and hyphens only.</p>
                </div>
                <button
                  onClick={() => {
                    if (!artistName.trim()) { setError('Artist name is required.'); return }
                    setError('')
                    setStep(2)
                  }}
                  className="w-full bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider"
                >
                  Continue →
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <p className="text-zinc-400 text-sm leading-relaxed mb-2">
                  Insound is for independent artists who control the rights needed to sell their music. Please confirm:
                </p>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={attest}
                    onChange={e => setAttest(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-700 bg-zinc-950 text-orange-600 focus:ring-orange-600 focus:ring-offset-0"
                  />
                  <span className="text-xs text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">
                    I control the rights needed to sell my music on Insound and am not signing up on behalf of a record label, management company, or any entity with an exclusive commercial distribution agreement. Using a non-exclusive DIY distributor (e.g. DistroKid, TuneCore, CD Baby) elsewhere does not make me ineligible.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={e => setTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-700 bg-zinc-950 text-orange-600 focus:ring-orange-600 focus:ring-offset-0"
                  />
                  <span className="text-xs text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">
                    I agree to the <Link href="/terms" className="text-orange-600 hover:text-orange-400">Terms of Service</Link>, <Link href="/privacy" className="text-orange-600 hover:text-orange-400">Privacy Policy</Link>, and <Link href="/ai-policy" className="text-orange-600 hover:text-orange-400">AI Content Policy</Link>.
                  </span>
                </label>
                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex-1 bg-zinc-800 text-white font-bold py-4 rounded-xl hover:bg-zinc-700 transition-colors text-sm">
                    ← Back
                  </button>
                  <button
                    onClick={() => {
                      if (!attest || !terms) { setError('Please confirm both checkboxes.'); return }
                      setError('')
                      setStep(3)
                    }}
                    className="flex-1 bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-4">Choose your accent colour</label>
                  <div className="grid grid-cols-5 gap-3">
                    {ACCENT_COLOURS.map(c => (
                      <button
                        key={c}
                        onClick={() => setAccent(c)}
                        className={`w-full aspect-square rounded-xl transition-all ${accent === c ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110' : 'hover:scale-105'}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="flex-1 bg-zinc-800 text-white font-bold py-4 rounded-xl hover:bg-zinc-700 transition-colors text-sm">
                    ← Back
                  </button>
                  <button onClick={() => setStep(4)} className="flex-1 bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider">
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Bio <span className="text-zinc-700">(optional)</span></label>
                  <textarea
                    placeholder="Tell fans about yourself..."
                    rows={4}
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600 resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(3)} className="flex-1 bg-zinc-800 text-white font-bold py-4 rounded-xl hover:bg-zinc-700 transition-colors text-sm">
                    ← Back
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={busy}
                    className="flex-1 bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {busy ? 'Setting up...' : 'Complete setup →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
