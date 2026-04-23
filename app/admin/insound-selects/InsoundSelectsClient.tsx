'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Artist {
  id: string
  slug: string
  name: string
  avatar_url: string | null
}

interface HistoryEntry {
  id: string
  artist_id: string
  week_of: string
  editorial_note: string | null
  artists: { name: string } | { name: string }[]
}

interface Props {
  artists: Artist[]
  history: HistoryEntry[]
}

export default function InsoundSelectsClient({ artists, history }: Props) {
  const [selectedArtist, setSelectedArtist] = useState('')
  const [weekOf, setWeekOf] = useState(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day
    return new Date(now.setDate(diff)).toISOString().slice(0, 10)
  })
  const [editorialNote, setEditorialNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [entries, setEntries] = useState(history)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedArtist || !weekOf) return

    setSaving(true)
    setMessage(null)

    const supabase = createClient()
    const { error } = await supabase
      .from('featured_artists')
      .upsert(
        {
          artist_id: selectedArtist,
          week_of: weekOf,
          editorial_note: editorialNote || null,
        },
        { onConflict: 'week_of' }
      )

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      const artistName = artists.find(a => a.id === selectedArtist)?.name ?? 'Unknown'
      setMessage({ type: 'success', text: `Featured ${artistName} for week of ${weekOf}` })
      setEntries(prev => [
        { id: crypto.randomUUID(), artist_id: selectedArtist, week_of: weekOf, editorial_note: editorialNote || null, artists: { name: artistName } },
        ...prev.filter(e => e.week_of !== weekOf),
      ])
      setEditorialNote('')
    }

    setSaving(false)
  }

  const getArtistName = (entry: HistoryEntry) => {
    const a = entry.artists
    return Array.isArray(a) ? a[0]?.name : a?.name
  }

  return (
    <div className="min-h-screen font-display">
      <nav
        className="sticky top-0 w-full z-50 flex justify-between items-center px-5 md:px-10 py-4"
        style={{
          background: 'rgba(9,9,11,0.88)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(39,39,42,0.8)',
        }}
      >
        <Link href="/" className="text-xl font-black text-orange-600 tracking-tighter">
          insound.
        </Link>
        <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Admin</span>
      </nav>

      <main className="max-w-2xl mx-auto px-5 py-12">
        <h1 className="text-3xl font-black tracking-tight mb-2">Insound Selects</h1>
        <p className="text-zinc-500 text-sm mb-10">Feature an artist on the Discover page each week.</p>

        <form onSubmit={handleSubmit} className="space-y-5 mb-14">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
              Artist
            </label>
            <select
              value={selectedArtist}
              onChange={e => setSelectedArtist(e.target.value)}
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-orange-600 transition-colors"
            >
              <option value="">Select an artist...</option>
              {artists.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
              Week of (Sunday)
            </label>
            <input
              type="date"
              value={weekOf}
              onChange={e => setWeekOf(e.target.value)}
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-orange-600 transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
              Editorial Note
            </label>
            <textarea
              value={editorialNote}
              onChange={e => setEditorialNote(e.target.value)}
              rows={3}
              placeholder="Why this artist? What makes them special this week?"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-orange-600 transition-colors placeholder-zinc-600 resize-none"
            />
          </div>

          {message && (
            <div className={`text-sm font-bold px-4 py-3 rounded-xl ${
              message.type === 'success'
                ? 'bg-green-900/30 text-green-400 border border-green-800/50'
                : 'bg-red-900/30 text-red-400 border border-red-800/50'
            }`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !selectedArtist}
            className="w-full bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Set Featured Artist'}
          </button>
        </form>

        {/* History */}
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4">
            Recent Selections
          </h2>
          {entries.length === 0 ? (
            <p className="text-zinc-600 text-sm">No selections yet.</p>
          ) : (
            <div className="space-y-2">
              {entries.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="font-bold text-sm">{getArtistName(entry)}</p>
                    {entry.editorial_note && (
                      <p className="text-xs text-zinc-500 truncate max-w-sm mt-0.5">
                        {entry.editorial_note}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-bold text-zinc-600 flex-shrink-0 ml-4">
                    {entry.week_of}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
