'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Programme = {
  total_spots: number
  filled_count: number
  paused: boolean
}

type FoundingArtist = {
  id: string
  name: string
  confirmedAt: string | null
  firstSaleAt: string | null
  daysRemaining: number | null
  totalSalesPence: number
  estimatedDiscountPence: number
}

type Props = {
  programme: Programme
  artists: FoundingArtist[]
  totalDiscountPence: number
}

function pence(n: number) {
  return `£${(n / 100).toFixed(2)}`
}

export function FoundingArtistsClient({ programme, artists, totalDiscountPence }: Props) {
  const [paused, setPaused] = useState(programme.paused)
  const [toggling, setToggling] = useState(false)

  async function togglePause() {
    setToggling(true)
    try {
      const supabase = createClient()
      const newPaused = !paused
      const { error } = await supabase
        .from('founding_artist_programme')
        .update({ paused: newPaused })
        .eq('id', 1)
      if (!error) setPaused(newPaused)
    } catch {}
    setToggling(false)
  }

  const spotsRemaining = programme.total_spots - programme.filled_count

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-8">
      <div className="max-w-5xl mx-auto space-y-10">
        <div>
          <a href="/admin" className="text-2xl font-display font-bold text-orange-600 tracking-tighter hover:text-orange-500 transition-colors">insound.</a>
          <h1 className="text-3xl font-display font-bold tracking-tight mt-4">Founding Artists</h1>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Spots Filled</p>
            <p className="text-2xl font-bold">{programme.filled_count} / {programme.total_spots}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Spots Remaining</p>
            <p className="text-2xl font-bold">{spotsRemaining}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Total Discount Given</p>
            <p className="text-2xl font-bold">{pence(totalDiscountPence)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Programme Status</p>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-sm font-bold ${paused ? 'text-red-400' : 'text-green-400'}`}>
                {paused ? 'Paused' : 'Active'}
              </span>
              <button
                onClick={togglePause}
                disabled={toggling}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  paused
                    ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                    : 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                } disabled:opacity-50`}
              >
                {toggling ? '...' : paused ? 'Resume' : 'Pause'}
              </button>
            </div>
          </div>
        </div>

        {/* Artists table */}
        <section>
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4">Artists ({artists.length})</h2>
          {artists.length === 0 ? (
            <p className="text-zinc-500 text-sm">No Founding Artists yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Artist</th>
                    <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Confirmed</th>
                    <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">First Sale</th>
                    <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Days Left</th>
                    <th className="text-right py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Total Sales</th>
                    <th className="text-right py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Est. Discount</th>
                  </tr>
                </thead>
                <tbody>
                  {artists.map(a => (
                    <tr key={a.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                      <td className="py-3 px-4 font-medium">{a.name}</td>
                      <td className="py-3 px-4 text-zinc-400">
                        {a.confirmedAt ? new Date(a.confirmedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        {a.firstSaleAt ? new Date(a.firstSaleAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-4">
                        {a.daysRemaining === null ? (
                          <span className="text-zinc-500">Awaiting sale</span>
                        ) : a.daysRemaining === 0 ? (
                          <span className="text-red-400">Expired</span>
                        ) : (
                          <span className="text-green-400">{a.daysRemaining}d</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">{pence(a.totalSalesPence)}</td>
                      <td className="py-3 px-4 text-right font-mono text-orange-400">{pence(a.estimatedDiscountPence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
