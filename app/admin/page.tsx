import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin'
import { createClient } from '@supabase/supabase-js'
import { AdminFeatureFlags } from './AdminFeatureFlags'

export const metadata: Metadata = {
  title: 'Admin — Insound',
}

async function getStats() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const [
    { count: artistCount },
    { count: fanCount },
    { count: releaseCount },
    { data: purchaseStats },
    { count: waitlistCount },
  ] = await Promise.all([
    supabase.from('artists').select('id', { count: 'exact', head: true }),
    supabase.from('fan_profiles').select('id', { count: 'exact', head: true }),
    supabase.from('releases').select('id', { count: 'exact', head: true }).eq('published', true),
    supabase.from('purchases').select('amount_pence, status, pre_order').eq('status', 'paid'),
    supabase.from('waitlist').select('id', { count: 'exact', head: true }),
  ])

  const purchases = purchaseStats ?? []
  const totalRevenue = purchases.reduce((s: number, p: any) => s + (p.amount_pence || 0), 0)
  const insoundRevenue = Math.round(totalRevenue * 0.10)
  const activePreOrders = purchases.filter((p: any) => p.pre_order).length

  return {
    artists: artistCount ?? 0,
    fans: fanCount ?? 0,
    releases: releaseCount ?? 0,
    totalSales: purchases.length,
    totalRevenue,
    insoundRevenue,
    activePreOrders,
    waitlist: waitlistCount ?? 0,
    waitlistRemaining: Math.max(0, 50 - (waitlistCount ?? 0)),
  }
}

export default async function AdminPage() {
  const { supabase } = await requireAdmin()

  const stats = await getStats()

  const { data: flags } = await supabase
    .from('site_settings')
    .select('*')
    .order('key')

  const links = [
    { href: '/admin/broadcast', label: 'Broadcast', description: 'Send emails to artists and fans' },
    { href: '/admin/insound-selects', label: 'Insound Selects', description: 'Curate featured releases' },
    { href: '/admin/flags', label: 'Security Flags', description: 'Review suspicious activity flags' },
  ]

  const statCards = [
    { label: 'Artists', value: stats.artists },
    { label: 'Fans', value: stats.fans },
    { label: 'Published Releases', value: stats.releases },
    { label: 'Total Sales', value: stats.totalSales },
    { label: 'Total Revenue', value: `£${(stats.totalRevenue / 100).toFixed(2)}` },
    { label: 'Insound Revenue', value: `£${(stats.insoundRevenue / 100).toFixed(2)}` },
    { label: 'Active Pre-orders', value: stats.activePreOrders },
    { label: 'Waitlist Signups', value: stats.waitlist },
    { label: 'Waitlist Remaining', value: stats.waitlistRemaining },
  ]

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-8">
      <div className="max-w-5xl mx-auto space-y-10">
        <div>
          <a href="/" className="text-2xl font-display font-bold text-orange-600 tracking-tighter hover:text-orange-500 transition-colors">insound.</a>
          <h1 className="text-3xl font-display font-bold tracking-tight mt-4">Admin</h1>
        </div>

        {/* Platform Stats */}
        <section>
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4">Platform Stats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {statCards.map(s => (
              <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-2xl font-black tracking-tight">{s.value}</p>
                <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Feature Flags */}
        <section>
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4">Feature Flags</h2>
          <AdminFeatureFlags initialFlags={flags ?? []} />
        </section>

        {/* Tools */}
        <section>
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4">Tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {links.map(l => (
              <a
                key={l.href}
                href={l.href}
                className="block bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 hover:bg-zinc-900/80 transition-all"
              >
                <p className="font-bold text-sm">{l.label}</p>
                <p className="text-xs text-zinc-500 mt-1">{l.description}</p>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
