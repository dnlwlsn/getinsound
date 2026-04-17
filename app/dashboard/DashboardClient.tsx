'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ColourPicker } from '@/app/components/ui/ColourPicker'
import { SoftNudge } from '@/app/components/ui/SoftNudge'
import { generateGradientDataUri } from '@/lib/gradient'

// ── Types ──────────────────────────────────────────────────────
type Artist = { id: string; slug: string; name: string; bio: string | null; avatar_url: string | null; accent_colour: string | null }
type Account = { id: string; email: string; stripe_account_id: string | null; stripe_onboarded: boolean }
type Track = { id: string; preview_plays: number; full_plays: number }
type Release = {
  id: string; slug: string; title: string; type: string; cover_url: string | null
  price_pence: number; published: boolean; pwyw_enabled: boolean; pwyw_minimum_pence: number | null
  preorder_enabled: boolean; release_date: string | null; visibility: string; created_at: string
  tracks: Track[]
}
type Stats = {
  totalEarningsPence: number; monthEarningsPence: number; totalSales: number
  totalPreviewPlays: number; totalFullPlays: number; uniqueFans: number
  avgPaidPence: number; avgMinPence: number
}
type Fan = { displayEmail: string; purchaseCount: number; totalPence: number; purchases: { release_id: string; amount_pence: number; paid_at: string | null }[] }
type CodeSummary = { total: number; redeemed: number }

type Props = {
  artist: Artist; account: Account; releases: Release[]; stats: Stats
  fans: Fan[]; codesByRelease: Record<string, CodeSummary>
}

function pence(n: number) { return `£${(n / 100).toFixed(2)}` }

// ── Component ──────────────────────────────────────────────────
export function DashboardClient({ artist, account, releases, stats, fans, codesByRelease }: Props) {
  const supabase = createClient()
  const [rels, setRels] = useState(releases)
  const [payouts, setPayouts] = useState<any[] | null>(null)
  const [stripeBalance, setStripeBalance] = useState<{ available_pence: number; pending_pence: number } | null>(null)
  const [stripeDashUrl, setStripeDashUrl] = useState('')
  const [payoutsLoading, setPayoutsLoading] = useState(false)
  const [expandedFan, setExpandedFan] = useState<number | null>(null)
  const [generatingCodes, setGeneratingCodes] = useState<string | null>(null)
  const [accentSaving, setAccentSaving] = useState(false)

  // ── Stripe payouts ───────────────────────────────────────────
  async function loadPayouts() {
    if (payouts) return
    setPayoutsLoading(true)
    try {
      const res = await fetch('/api/dashboard/payouts')
      const data = await res.json()
      setPayouts(data.payouts || [])
      setStripeBalance(data.balance || null)
      setStripeDashUrl(data.dashboard_url || '')
    } catch { setPayouts([]) }
    setPayoutsLoading(false)
  }

  // ── Release toggles ─────────────────────────────────────────
  async function toggleField(releaseId: string, field: string, value: any) {
    const { error } = await supabase.from('releases').update({ [field]: value }).eq('id', releaseId)
    if (!error) setRels(prev => prev.map(r => r.id === releaseId ? { ...r, [field]: value } : r))
  }

  // ── Download codes ──────────────────────────────────────────
  async function generateCodes(releaseId: string) {
    setGeneratingCodes(releaseId)
    try {
      await fetch('/api/dashboard/download-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ release_id: releaseId, count: 10 }),
      })
    } catch {}
    setGeneratingCodes(null)
  }

  // ── Accent colour save ─────────────────────────────────────
  async function saveAccent(colour: string) {
    setAccentSaving(true)
    await supabase.from('artists').update({ accent_colour: colour }).eq('id', artist.id)
    setAccentSaving(false)
  }

  return (
    <div className="min-h-screen flex bg-[#09090b] text-zinc-100">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-64 border-r border-zinc-900 p-8 hidden md:flex flex-col flex-shrink-0 sticky top-0 h-screen">
        <a href="/" className="text-2xl font-display font-bold text-orange-600 tracking-tighter mb-12 block hover:text-orange-500 transition-colors">insound.</a>
        <nav className="space-y-1 flex-1">
          <SidebarLink href="/dashboard" label="Dashboard" active />
          <SidebarLink href="/discography" label="Discography" />
          <SidebarLink href="/sales" label="Sales & Payouts" />
          <SidebarLink href="/explore" label="Browse Store" />
        </nav>
        <div className="pt-6 border-t border-zinc-900">
          <a href="/" className="block text-zinc-600 hover:text-red-400 font-bold text-xs uppercase tracking-wider py-2 transition-colors">Log Out</a>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto p-8 md:p-12">

          {/* Header */}
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12 gap-4">
            <div>
              <p className="text-zinc-500 text-sm font-semibold mb-1">Welcome back</p>
              <h1 className="text-4xl font-display font-bold tracking-tight">{artist.name}</h1>
            </div>
            <a href="/discography" className="bg-orange-600 text-black font-bold px-7 py-3.5 rounded-xl hover:bg-orange-500 transition-colors shadow-lg shadow-orange-600/20 text-sm uppercase tracking-wider flex items-center gap-2 shrink-0">
              + Upload Track
            </a>
          </header>

          {/* ── 1. Stats ───────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <StatBox label="Lifetime Earnings" value={pence(stats.totalEarningsPence)} sub={`${pence(stats.monthEarningsPence)} this month`} />
            <StatBox label="Total Sales" value={String(stats.totalSales)} />
            <StatBox label="Plays" value={String(stats.totalPreviewPlays + stats.totalFullPlays)} sub={`${stats.totalPreviewPlays} preview · ${stats.totalFullPlays} full`} />
            <StatBox label="Unique Fans" value={String(stats.uniqueFans)} />
          </div>
          {stats.avgPaidPence > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">PWYW Insight</p>
              <p className="text-sm text-zinc-400">
                Average paid: <span className="text-orange-500 font-bold">{pence(stats.avgPaidPence)}</span>
                {stats.avgMinPence > 0 && <> vs average minimum set: <span className="text-zinc-300 font-bold">{pence(stats.avgMinPence)}</span></>}
              </p>
            </div>
          )}

          {/* ── 2. Releases ────────────────────────────────── */}
          <Section title="Releases" count={rels.length}>
            {rels.length === 0 ? (
              <p className="text-zinc-600 text-sm py-10 text-center">No releases yet.</p>
            ) : (
              <div className="space-y-3">
                {rels.map(r => (
                  <ReleaseRow
                    key={r.id}
                    release={r}
                    artistId={artist.id}
                    artistSlug={artist.slug}
                    codes={codesByRelease[r.id]}
                    onToggle={toggleField}
                    onGenerateCodes={generateCodes}
                    generatingCodes={generatingCodes === r.id}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* ── 3. Payout History ──────────────────────────── */}
          <Section title="Payout History">
            {!payouts ? (
              <button onClick={loadPayouts} className="text-sm text-orange-500 hover:text-orange-400 font-bold transition-colors">
                {payoutsLoading ? 'Loading...' : 'Load payout history from Stripe'}
              </button>
            ) : payouts.length === 0 ? (
              <p className="text-zinc-600 text-sm">No payouts yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="pb-3">Date</th><th className="pb-3">Amount</th><th className="pb-3">Status</th>
                </tr></thead>
                <tbody>
                  {payouts.map((p: any) => (
                    <tr key={p.id} className="border-t border-zinc-800/60">
                      <td className="py-3 text-zinc-400">{p.arrival_date ? new Date(p.arrival_date).toLocaleDateString() : '—'}</td>
                      <td className="py-3 font-bold">{pence(p.amount_pence)}</td>
                      <td className="py-3"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {stripeBalance && stripeBalance.available_pence > 0 && stripeBalance.available_pence < 200 && (
              <SoftNudge balance={pence(stripeBalance.available_pence)} className="mt-4" />
            )}
          </Section>

          {/* ── 4. Fanbase ─────────────────────────────────── */}
          <Section title="Fanbase" count={fans.length}>
            {fans.length === 0 ? (
              <p className="text-zinc-600 text-sm">No fans yet. Sales will appear here.</p>
            ) : (
              <div className="space-y-2">
                {fans.map((fan, i) => (
                  <div key={i} className="bg-zinc-900/50 rounded-xl border border-zinc-800/60 overflow-hidden">
                    <button
                      onClick={() => setExpandedFan(expandedFan === i ? null : i)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500">
                          {fan.displayEmail[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{fan.displayEmail}</p>
                          <p className="text-[10px] text-zinc-500">{fan.purchaseCount} purchase{fan.purchaseCount !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-orange-500">{pence(fan.totalPence)}</span>
                    </button>
                    {expandedFan === i && (
                      <div className="px-4 pb-4 pt-0 border-t border-zinc-800/40">
                        {fan.purchases.map((p, j) => {
                          const rel = rels.find(r => r.id === p.release_id)
                          return (
                            <div key={j} className="flex justify-between py-2 text-xs text-zinc-400">
                              <span>{rel?.title || 'Unknown release'}</span>
                              <span className="font-bold text-zinc-300">{pence(p.amount_pence)}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── 5. Stripe Connect ──────────────────────────── */}
          <Section title="Stripe Connect">
            <div className="flex items-center gap-4">
              <StatusBadge status={account.stripe_onboarded ? 'active' : 'pending'} />
              <p className="text-sm text-zinc-400">
                {account.stripe_onboarded
                  ? `Connected as ${account.stripe_account_id}`
                  : 'Stripe onboarding incomplete'}
              </p>
            </div>
            {account.stripe_onboarded && stripeDashUrl && (
              <a href={stripeDashUrl} target="_blank" rel="noopener noreferrer"
                className="mt-4 inline-block text-sm text-orange-500 hover:text-orange-400 font-bold transition-colors">
                Open Stripe Express Dashboard &rarr;
              </a>
            )}
            {!account.stripe_onboarded && (
              <a href="/discography" className="mt-4 inline-block bg-orange-600 text-black font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider hover:bg-orange-500 transition-colors">
                Complete Stripe Setup
              </a>
            )}
          </Section>

          {/* ── 6. Download Codes ──────────────────────────── */}
          <Section title="Download Codes">
            {rels.length === 0 ? (
              <p className="text-zinc-600 text-sm">Upload a release to generate download codes.</p>
            ) : (
              <div className="space-y-3">
                {rels.map(r => {
                  const c = codesByRelease[r.id]
                  return (
                    <div key={r.id} className="flex items-center justify-between py-3 border-b border-zinc-800/40 last:border-0">
                      <div>
                        <p className="text-sm font-bold">{r.title}</p>
                        <p className="text-[10px] text-zinc-500">
                          {c ? `${c.redeemed} / ${c.total} redeemed` : 'No codes generated'}
                        </p>
                      </div>
                      <button
                        onClick={() => generateCodes(r.id)}
                        disabled={generatingCodes === r.id}
                        className="text-xs font-bold text-orange-500 hover:text-orange-400 disabled:opacity-50 transition-colors"
                      >
                        {generatingCodes === r.id ? 'Generating...' : '+ Generate 10 Codes'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {/* ── Accent Colour ──────────────────────────────── */}
          <Section title="Profile Accent Colour">
            <p className="text-zinc-500 text-sm mb-4">Used for price pills, play button, waveform scrubber, and your profile header.</p>
            <ColourPicker
              value={artist.accent_colour}
              onChange={(c) => saveAccent(c)}
            />
            {accentSaving && <p className="text-xs text-zinc-500 mt-2">Saving...</p>}
          </Section>

        </div>
      </main>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────

function SidebarLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <a href={href} className={`flex items-center gap-3 p-3.5 font-bold rounded-xl text-sm transition-all
      ${active ? 'bg-orange-600/10 text-orange-500' : 'text-zinc-500 hover:bg-orange-600/[0.06] hover:text-white'}`}>
      {label}
    </a>
  )
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
      <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-3">{label}</p>
      <p className="text-3xl font-display font-bold tracking-tight text-orange-500">{value}</p>
      {sub && <p className="text-xs text-zinc-600 font-semibold mt-2">{sub}</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: 'text-green-500 bg-green-600/10 border-green-600/20',
    active: 'text-green-500 bg-green-600/10 border-green-600/20',
    pending: 'text-yellow-500 bg-yellow-600/10 border-yellow-600/20',
    in_transit: 'text-blue-500 bg-blue-600/10 border-blue-600/20',
    failed: 'text-red-500 bg-red-600/10 border-red-600/20',
    canceled: 'text-zinc-500 bg-zinc-800 border-zinc-700',
  }
  const s = styles[status] || styles.pending
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${s}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6 md:p-8 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="font-display font-bold text-lg">{title}</h2>
        {count !== undefined && (
          <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{count}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function ReleaseRow({ release: r, artistId, artistSlug, codes, onToggle, onGenerateCodes, generatingCodes }: {
  release: Release; artistId: string; artistSlug: string; codes?: CodeSummary
  onToggle: (id: string, field: string, value: any) => void
  onGenerateCodes: (id: string) => void; generatingCodes: boolean
}) {
  const [showControls, setShowControls] = useState(false)
  const plays = r.tracks.reduce((s, t) => s + t.preview_plays + t.full_plays, 0)
  const coverSrc = r.cover_url || generateGradientDataUri(artistId, r.id)

  return (
    <div className="bg-zinc-900/80 border border-zinc-800/60 rounded-xl overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        <img src={coverSrc} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{r.title}</p>
          <p className="text-[10px] text-zinc-500">{r.type} · {r.tracks.length} track{r.tracks.length !== 1 ? 's' : ''} · {plays} plays</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <VisibilityBadge v={r.visibility} />
          <a href={`/release?a=${artistSlug}&r=${r.slug}`} className="text-[10px] text-zinc-500 hover:text-orange-500 font-bold transition-colors">View</a>
          <button onClick={() => setShowControls(!showControls)} className="text-zinc-500 hover:text-white transition-colors p-1">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
            </svg>
          </button>
        </div>
      </div>

      {showControls && (
        <div className="border-t border-zinc-800/40 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* PWYW toggle */}
          <Toggle
            label="Pay What You Want"
            checked={r.pwyw_enabled}
            onChange={(v) => onToggle(r.id, 'pwyw_enabled', v)}
          />
          {r.pwyw_enabled && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">PWYW Minimum (pence)</label>
              <input
                type="number"
                defaultValue={r.pwyw_minimum_pence || 0}
                min={0}
                onBlur={(e) => onToggle(r.id, 'pwyw_minimum_pence', parseInt(e.target.value) || 0)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 text-sm text-white focus:border-orange-600 outline-none transition-colors"
              />
            </div>
          )}

          {/* Pre-order */}
          <Toggle
            label="Pre-order"
            checked={r.preorder_enabled}
            onChange={(v) => onToggle(r.id, 'preorder_enabled', v)}
          />
          {r.preorder_enabled && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">Release Date</label>
              <input
                type="date"
                defaultValue={r.release_date || ''}
                onChange={(e) => onToggle(r.id, 'release_date', e.target.value || null)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 text-sm text-white focus:border-orange-600 outline-none transition-colors"
              />
            </div>
          )}

          {/* Visibility */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">Visibility</label>
            <select
              value={r.visibility}
              onChange={(e) => onToggle(r.id, 'visibility', e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 text-sm text-white focus:border-orange-600 outline-none transition-colors"
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </div>

          {/* Published */}
          <Toggle
            label="Published"
            checked={r.published}
            onChange={(v) => onToggle(r.id, 'published', v)}
          />
        </div>
      )}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-xs font-bold text-zinc-400">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors ${checked ? 'bg-orange-600' : 'bg-zinc-700'}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'left-5' : 'left-1'}`} />
      </button>
    </label>
  )
}

function VisibilityBadge({ v }: { v: string }) {
  const styles: Record<string, string> = {
    public: 'text-orange-500 bg-orange-600/10 border-orange-600/20',
    unlisted: 'text-yellow-500 bg-yellow-600/10 border-yellow-600/20',
    private: 'text-zinc-500 bg-zinc-800 border-zinc-700',
  }
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles[v] || styles.public}`}>
      {v}
    </span>
  )
}
