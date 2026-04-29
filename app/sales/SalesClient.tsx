'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { InsoundLogo } from '@/app/components/ui/InsoundLogo'
import { createClient } from '@/lib/supabase/client'
import { formatPrice as formatPriceUtil } from '@/app/lib/currency'

const fmtPayout = (n: number, cur: string) => formatPriceUtil(n, cur || 'GBP')

interface Payout {
  id: string
  amount_pence: number
  currency: string
  status: string
  arrival_date: string | null
  created: string
}

interface PayoutData {
  payouts: Payout[]
  balance: { available_pence: number; pending_pence: number }
  dashboard_url: string
  onboarded: boolean
  error?: string
}

export function SalesClient() {
  const supabase = createClient()
  const router = useRouter()
  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/')
  }, [supabase, router])

  const [data, setData] = useState<PayoutData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/payouts')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen flex font-display text-zinc-100 bg-insound-bg">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-900 p-8 hidden md:flex flex-col flex-shrink-0 sticky top-0 h-screen">
        <InsoundLogo size="lg" className="mb-12 block" />
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
            Explore
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
            <p className="text-zinc-500 text-sm mt-1">Track your earnings and manage payouts via Stripe.</p>
          </header>

          {loading ? (
            <div className="space-y-4">
              <div className="h-32 bg-zinc-900 rounded-2xl animate-pulse" />
              <div className="h-32 bg-zinc-900 rounded-2xl animate-pulse" />
            </div>
          ) : !data?.onboarded ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
              <div className="w-16 h-16 bg-orange-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-orange-600"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
              </div>
              <h2 className="font-black text-xl mb-2">Set up payouts</h2>
              <p className="text-zinc-400 text-sm mb-6 max-w-sm mx-auto">Complete your Stripe account setup to start receiving payments from fans.</p>
              <Link href="/dashboard" className="inline-block bg-orange-600 hover:bg-orange-500 text-black font-black px-6 py-3.5 rounded-xl transition-colors text-sm">
                Go to Dashboard →
              </Link>
            </div>
          ) : (
            <>
              {/* Stripe Dashboard Link */}
              <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 mb-12 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-zinc-200">Stripe manages your payouts</p>
                  <p className="text-xs text-zinc-500 mt-1">Earnings go directly to your connected Stripe account and are paid out to your bank automatically.</p>
                </div>
                {data.dashboard_url ? (
                  <a href={data.dashboard_url} target="_blank" rel="noopener noreferrer"
                    className="bg-white text-black font-black px-6 py-3.5 rounded-xl hover:bg-orange-600 hover:text-white transition-colors text-sm text-center shrink-0 ml-6">
                    Open Stripe Dashboard ↗
                  </a>
                ) : (
                  <p className="text-zinc-600 text-sm font-bold shrink-0 ml-6">Stripe dashboard unavailable</p>
                )}
              </div>

              {/* Payout History */}
              <div>
                <h2 className="font-black text-xl mb-5">Payout History</h2>
                {data.payouts.length === 0 ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <p className="py-20 text-center text-zinc-600 font-bold text-sm">No payouts yet. Earnings will be paid out automatically by Stripe.</p>
                  </div>
                ) : (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
                    {data.payouts.map(p => (
                      <div key={p.id} className="flex items-center justify-between px-6 py-4">
                        <div>
                          <p className="font-bold text-sm">{fmtPayout(p.amount_pence, p.currency)}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {p.arrival_date ? new Date(p.arrival_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Processing'}
                          </p>
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                          p.status === 'paid' ? 'bg-green-950 text-green-400' :
                          p.status === 'pending' ? 'bg-orange-950 text-orange-400' :
                          p.status === 'in_transit' ? 'bg-blue-950 text-blue-400' :
                          'bg-zinc-800 text-zinc-400'
                        }`}>
                          {p.status === 'in_transit' ? 'In transit' : p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {data.dashboard_url && (
                <p className="text-zinc-600 text-xs mt-6 text-center">
                  Payouts, bank details, and tax documents are managed in your{' '}
                  <a href={data.dashboard_url} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400 transition-colors">
                    Stripe Express Dashboard
                  </a>.
                </p>
              )}
            </>
          )}
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
    </div>
  )
}
