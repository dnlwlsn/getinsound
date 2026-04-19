'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export function SalesClient() {
  const supabase = createClient()
  const router = useRouter()
  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/')
  }, [supabase, router])

  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawStep, setWithdrawStep] = useState<1 | 2 | 3>(1)

  function openWithdraw() {
    setWithdrawStep(1)
    setWithdrawOpen(true)
  }

  function startWithdraw() {
    setWithdrawStep(2)
    setTimeout(() => setWithdrawStep(3), 2000)
  }

  return (
    <div className="min-h-screen flex font-display text-zinc-100" style={{ backgroundColor: '#09090b' }}>
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-900 p-8 hidden md:flex flex-col flex-shrink-0 sticky top-0 h-screen">
        <Link href="/" className="text-2xl font-black text-orange-600 tracking-tighter mb-12 block hover:text-orange-500 transition-colors">insound.</Link>
        <nav className="space-y-1 flex-1">
          <Link href="/dashboard" className="sidebar-link flex items-center gap-3 p-3.5 text-zinc-500 font-bold rounded-xl text-sm hover:bg-orange-600/[0.06] hover:text-white transition-all">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Dashboard
          </Link>
          <Link href="/discography" className="sidebar-link flex items-center gap-3 p-3.5 text-zinc-500 font-bold rounded-xl text-sm hover:bg-orange-600/[0.06] hover:text-white transition-all">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/></svg>
            Discography
          </Link>
          <Link href="/sales" className="flex items-center gap-3 p-3.5 bg-orange-600/10 text-orange-500 font-bold rounded-xl text-sm">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            Sales &amp; Payouts
          </Link>
          <Link href="/library" className="sidebar-link flex items-center gap-3 p-3.5 text-zinc-500 font-bold rounded-xl text-sm hover:bg-orange-600/[0.06] hover:text-white transition-all">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/></svg>
            My Collection
          </Link>
          <Link href="/explore" className="sidebar-link flex items-center gap-3 p-3.5 text-zinc-500 font-bold rounded-xl text-sm hover:bg-orange-600/[0.06] hover:text-white transition-all">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            Browse Store
          </Link>
        </nav>
        <div className="pt-6 border-t border-zinc-900">
          <button onClick={handleLogout} className="flex items-center gap-3 p-3.5 text-zinc-600 hover:text-red-400 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors w-full">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            Log Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto p-8 md:p-12">

          <header className="mb-10">
            <h1 className="text-4xl font-black tracking-tight">Sales &amp; Payouts</h1>
            <p className="text-zinc-500 text-sm mt-1">Track your earnings and transfer funds to your bank.</p>
          </header>

          {/* Balance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            <div className="md:col-span-2 bg-zinc-900 p-8 rounded-2xl border border-zinc-800 flex justify-between items-center gap-4">
              <div>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2">Available for Payout</p>
                <p className="text-4xl font-black text-orange-600">&pound;0.00</p>
                <p className="text-xs text-zinc-500 mt-2">Ready to withdraw &middot; Processed in 1&ndash;2 business days</p>
              </div>
              <button onClick={openWithdraw} className="bg-white text-black font-black px-6 py-3.5 rounded-xl hover:bg-orange-600 hover:text-white transition-colors text-sm flex-shrink-0">
                Withdraw
              </button>
            </div>
            <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2">Lifetime Gross</p>
              <p className="text-4xl font-black">&pound;0.00</p>
              <p className="text-xs text-zinc-500 mt-2">No sales yet</p>
            </div>
          </div>

          {/* Payout Method */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" fill="none" stroke="#60a5fa" strokeWidth="2" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Payout Method</p>
                <p className="font-bold text-sm">NatWest ••4821</p>
                <p className="text-xs text-zinc-500 mt-0.5">Next payout: <span className="text-orange-500 font-bold">5 Apr 2026</span></p>
              </div>
            </div>
            <button className="text-xs font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-colors">Edit</button>
          </div>

          {/* Revenue Chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-10">
            <div className="flex justify-between items-center mb-8">
              <div><h2 className="font-black text-lg">Revenue</h2><p className="text-zinc-500 text-xs mt-0.5">Last 6 months</p></div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-zinc-700" /><span className="text-xs text-zinc-600 font-bold">&pound;0 total</span></div>
            </div>
            <div className="flex items-end gap-3 h-36">
              {['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map((m) => (
                <div key={m} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-zinc-800 rounded-lg" style={{ height: '4px' }} />
                  <p className="text-[10px] text-zinc-600 font-bold">{m}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Earnings by Release */}
          <div className="mb-10">
            <h2 className="font-black text-xl mb-5">Earnings by Release</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <p className="text-zinc-600 font-bold text-sm py-8 text-center">No release earnings yet.</p>
            </div>
          </div>

          {/* Transaction History */}
          <div className="flex justify-between items-center mb-5">
            <h2 className="font-black text-xl">Transaction History</h2>
            <select className="bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-4 outline-none text-zinc-400 text-xs font-bold focus:border-orange-600 transition-colors">
              <option>All Time</option>
              <option>This Month</option>
              <option>Last Month</option>
            </select>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <p className="py-20 text-center text-zinc-600 font-bold text-sm">No transactions yet. Sales will appear here.</p>
          </div>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/95 border-t border-zinc-900 backdrop-blur-md z-50 flex">
        <Link href="/dashboard" className="flex-1 flex flex-col items-center gap-1 py-3 text-zinc-500 hover:text-white transition-colors">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <span className="text-[9px] font-black uppercase tracking-wider">Home</span>
        </Link>
        <Link href="/discography" className="flex-1 flex flex-col items-center gap-1 py-3 text-zinc-500 hover:text-white transition-colors">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"/></svg>
          <span className="text-[9px] font-black uppercase tracking-wider">Music</span>
        </Link>
        <Link href="/sales" className="flex-1 flex flex-col items-center gap-1 py-3 text-orange-500 hover:text-white transition-colors">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          <span className="text-[9px] font-black uppercase tracking-wider">Sales</span>
        </Link>
        <Link href="/explore" className="flex-1 flex flex-col items-center gap-1 py-3 text-zinc-500 hover:text-white transition-colors">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span className="text-[9px] font-black uppercase tracking-wider">Store</span>
        </Link>
      </nav>

      {/* Withdraw Modal */}
      {withdrawOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setWithdrawOpen(false)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-3xl p-8 w-full max-w-md shadow-2xl">

            {withdrawStep === 1 && (
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-black">Withdraw Funds</h3>
                    <p className="text-zinc-500 text-sm mt-1">Transfer to your bank account</p>
                  </div>
                  <button onClick={() => setWithdrawOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <div className="bg-zinc-950 rounded-2xl p-5 mb-6 border border-zinc-800 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Available</p>
                    <p className="text-3xl font-black text-orange-600">&pound;0.00</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500 font-bold">Arrives in</p>
                    <p className="font-black text-white">1&ndash;2 days</p>
                  </div>
                </div>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Amount to Withdraw (&pound;)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">&pound;</span>
                      <input type="number" defaultValue="0.00" min={1} step={0.01} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 pl-8 pr-4 outline-none text-white text-sm focus:border-orange-600 transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Bank Account</label>
                    <input type="text" placeholder="Sort code (00-00-00)" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none text-white text-sm placeholder-zinc-700 focus:border-orange-600 transition-colors mb-3 font-mono" />
                    <input type="text" placeholder="Account number" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none text-white text-sm placeholder-zinc-700 focus:border-orange-600 transition-colors font-mono" />
                  </div>
                </div>
                <button onClick={startWithdraw} className="w-full bg-orange-600 text-black font-black py-4 rounded-2xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider">Request Withdrawal</button>
                <p className="text-center text-[10px] text-zinc-600 mt-4">Secured &middot; Payments powered by Stripe</p>
              </div>
            )}

            {withdrawStep === 2 && (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full border-2 border-orange-600/30 border-t-orange-600 animate-spin mx-auto mb-6" />
                <h3 className="text-xl font-black mb-2">Processing...</h3>
                <p className="text-zinc-400 text-sm">Initiating your bank transfer</p>
              </div>
            )}

            {withdrawStep === 3 && (
              <div className="text-center py-6">
                <div className="w-20 h-20 bg-orange-600/15 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg width="40" height="40" fill="none" stroke="#ea580c" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h3 className="text-2xl font-black mb-2">Transfer initiated!</h3>
                <p className="text-zinc-400 text-sm mb-1">Your funds are on their way.</p>
                <p className="text-orange-600 font-bold text-sm mb-8">&pound;0.00 &rarr; Your bank account<br/><span className="text-zinc-500 font-normal">Arrives in 1&ndash;2 business days</span></p>
                <button onClick={() => setWithdrawOpen(false)} className="w-full bg-zinc-800 text-white font-bold py-3.5 rounded-2xl hover:bg-zinc-700 transition-colors text-sm">Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
