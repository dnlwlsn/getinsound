import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin'
import { AdminFeatureFlags } from './AdminFeatureFlags'
import { AdminStats } from './AdminStats'

export const metadata: Metadata = {
  title: 'Admin — Insound',
}

export default async function AdminPage() {
  await requireAdmin()

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const [
    { data: flags },
    { count: flagCount },
    { count: reportCount },
    { count: feedbackCount },
  ] = await Promise.all([
    serviceClient.from('site_settings').select('*').order('key'),
    serviceClient.from('suspicious_activity_flags').select('*', { count: 'exact', head: true }).eq('reviewed', false),
    serviceClient.from('profile_reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    serviceClient.from('user_feedback').select('*', { count: 'exact', head: true }).eq('status', 'new'),
  ])

  const badgeCounts: Record<string, number> = {
    '/admin/flags': flagCount ?? 0,
    '/admin/reports': reportCount ?? 0,
    '/admin/feedback': feedbackCount ?? 0,
  }

  const links = [
    { href: '/admin/founding-artists', label: 'Founding Artists', description: 'View programme status, spots filled, pause toggle' },
    { href: '/admin/badges', label: 'Badges', description: 'Award Beta Tester and Founder badges' },
    { href: '/admin/broadcast', label: 'Broadcast', description: 'Send emails to artists and fans' },
    { href: '/admin/insound-selects', label: 'Insound Selects', description: 'Curate featured releases' },
    { href: '/admin/flags', label: 'Security Flags', description: 'Review suspicious activity flags' },
    { href: '/admin/reports', label: 'Profile Reports', description: 'Review user-submitted profile reports' },
    { href: '/admin/feedback', label: 'User Feedback', description: 'Bug reports, feature requests, and general feedback' },
  ]

  return (
    <div className="min-h-screen bg-insound-bg text-zinc-100 p-8">
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
            {links.map(l => {
              const count = badgeCounts[l.href] ?? 0
              return (
                <a
                  key={l.href}
                  href={l.href}
                  className="relative block bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 hover:bg-zinc-900/80 transition-all"
                >
                  {count > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-orange-600 text-white text-[11px] font-bold px-1.5">
                      {count}
                    </span>
                  )}
                  <p className="font-bold text-sm">{l.label}</p>
                  <p className="text-xs text-zinc-500 mt-1">{l.description}</p>
                </a>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
