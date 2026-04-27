import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin'
import { AdminFeatureFlags } from './AdminFeatureFlags'
import { AdminStats } from './AdminStats'

export const metadata: Metadata = {
  title: 'Admin — Insound',
}

export default async function AdminPage() {
  const { supabase } = await requireAdmin()

  const { data: flags } = await supabase
    .from('site_settings')
    .select('*')
    .order('key')

  const links = [
    { href: '/admin/founding-artists', label: 'Founding Artists', description: 'View programme status, spots filled, pause toggle' },
    { href: '/admin/broadcast', label: 'Broadcast', description: 'Send emails to artists and fans' },
    { href: '/admin/insound-selects', label: 'Insound Selects', description: 'Curate featured releases' },
    { href: '/admin/flags', label: 'Security Flags', description: 'Review suspicious activity flags' },
  ]

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-8">
      <div className="max-w-5xl mx-auto space-y-10">
        <div>
          <a href="/" className="text-2xl font-display font-bold text-orange-600 tracking-tighter hover:text-orange-500 transition-colors">insound.</a>
          <h1 className="text-3xl font-display font-bold tracking-tight mt-4">Admin</h1>
        </div>

        {/* Platform Stats */}
        <AdminStats />

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
