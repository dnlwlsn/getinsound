'use client'

import Link from 'next/link'

const stats = [
  { label: 'Total Plays', value: '0', color: '' },
  { label: 'Total Revenue', value: '\u00A30', color: 'text-orange-600' },
  { label: 'Live Releases', value: '0', color: '' },
  { label: 'Top Track', value: '\u2014', color: 'text-zinc-600 text-sm' },
]

export function DiscographyClient() {
  return (
    <div className="min-h-screen flex font-display text-zinc-100" style={{ backgroundColor: '#09090b' }}>
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-900 p-8 hidden md:flex flex-col flex-shrink-0 sticky top-0 h-screen">
        <Link href="/" className="text-2xl font-black text-orange-600 tracking-tighter mb-12 block hover:text-orange-500 transition-colors">insound.</Link>
        <nav className="space-y-1 flex-1">
          <Link href="/dashboard" className="flex items-center gap-3 p-3.5 text-zinc-500 font-bold rounded-xl text-sm hover:bg-orange-600/[0.06] hover:text-white transition-all">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Dashboard
          </Link>
          <Link href="/discography" className="flex items-center gap-3 p-3.5 bg-orange-600/10 text-orange-500 font-bold rounded-xl text-sm">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/></svg>
            Discography
          </Link>
          <Link href="/sales" className="flex items-center gap-3 p-3.5 text-zinc-500 font-bold rounded-xl text-sm hover:bg-orange-600/[0.06] hover:text-white transition-all">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            Sales &amp; Payouts
          </Link>
          <Link href="/library" className="flex items-center gap-3 p-3.5 text-zinc-500 font-bold rounded-xl text-sm hover:bg-orange-600/[0.06] hover:text-white transition-all">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/></svg>
            My Collection
          </Link>
          <Link href="/explore" className="flex items-center gap-3 p-3.5 text-zinc-500 font-bold rounded-xl text-sm hover:bg-orange-600/[0.06] hover:text-white transition-all">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            Browse Store
          </Link>
        </nav>
        <div className="pt-6 border-t border-zinc-900">
          <Link href="/" className="flex items-center gap-3 p-3.5 text-zinc-600 hover:text-red-400 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            Log Out
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto p-8 md:p-12">

          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
            <div>
              <h1 className="text-4xl font-black tracking-tight">Discography</h1>
              <p className="text-zinc-500 text-sm mt-1">0 releases</p>
            </div>
            <button className="bg-orange-600 text-black font-black px-6 py-3 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider flex items-center gap-2 flex-shrink-0">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Release
            </button>
          </header>

          {/* Stats banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {stats.map((s, i) => (
              <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5" style={{ animationDelay: `${i * 0.08}s` }}>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{s.label}</p>
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Releases table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-zinc-800/60 text-zinc-500 text-[10px] uppercase font-black tracking-widest border-b border-zinc-800">
                <tr>
                  <th className="p-5 pl-6">#</th>
                  <th className="p-5">Release</th>
                  <th className="p-5 hidden md:table-cell">Status</th>
                  <th className="p-5 hidden md:table-cell">Price</th>
                  <th className="p-5 hidden lg:table-cell">Plays</th>
                  <th className="p-5 hidden lg:table-cell">Revenue</th>
                  <th className="p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                <tr>
                  <td colSpan={7} className="py-20 text-center text-zinc-600 font-bold text-sm">No releases yet. Upload your first track to get started.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/95 border-t border-zinc-900 backdrop-blur-md z-50 flex">
        <Link href="/dashboard" className="flex-1 flex flex-col items-center gap-1 py-3 text-zinc-500 hover:text-white transition-colors">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <span className="text-[9px] font-black uppercase tracking-wider">Home</span>
        </Link>
        <Link href="/discography" className="flex-1 flex flex-col items-center gap-1 py-3 text-orange-500 hover:text-white transition-colors">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/></svg>
          <span className="text-[9px] font-black uppercase tracking-wider">Music</span>
        </Link>
        <Link href="/sales" className="flex-1 flex flex-col items-center gap-1 py-3 text-zinc-500 hover:text-white transition-colors">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          <span className="text-[9px] font-black uppercase tracking-wider">Sales</span>
        </Link>
        <Link href="/explore" className="flex-1 flex flex-col items-center gap-1 py-3 text-zinc-500 hover:text-white transition-colors">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span className="text-[9px] font-black uppercase tracking-wider">Store</span>
        </Link>
      </nav>
    </div>
  )
}
