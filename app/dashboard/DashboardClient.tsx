'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ColourPicker } from '@/app/components/ui/ColourPicker'
import { SoftNudge } from '@/app/components/ui/SoftNudge'
import { generateGradientDataUri } from '@/lib/gradient'
import { referralShareUrl, twitterShareUrl, whatsappShareUrl, emailShareUrl } from '@/lib/referral'
import { isZeroFeesActive } from '@/app/lib/fees'
import { NotificationBell } from '@/app/components/ui/NotificationBell'
import { formatPrice as formatPriceUtil } from '@/app/lib/currency'

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

type Referral = {
  code: string; count: number; zeroFeesUnlocked: boolean
  zeroFeesStart: string | null; artistHasZeroFees: boolean
}

type Milestone = {
  artistName: string
  achievedAt: string | null
}

type Props = {
  artist: Artist; account: Account; releases: Release[]; stats: Stats
  fans: Fan[]; codesByRelease: Record<string, CodeSummary>
  fanUsername: string | null; fanIsPublic: boolean
  milestone?: Milestone
  referral?: Referral
}

function pence(n: number) { return formatPriceUtil(n / 100, 'GBP') }

// ── Component ──────────────────────────────────────────────────
export function DashboardClient({ artist, account, releases, stats, fans, codesByRelease, fanUsername, fanIsPublic, milestone, referral }: Props) {
  const supabase = createClient()
  const [rels, setRels] = useState(releases)
  const [payouts, setPayouts] = useState<any[] | null>(null)
  const [stripeBalance, setStripeBalance] = useState<{ available_pence: number; pending_pence: number } | null>(null)
  const [stripeDashUrl, setStripeDashUrl] = useState('')
  const [payoutsLoading, setPayoutsLoading] = useState(false)
  const [expandedFan, setExpandedFan] = useState<number | null>(null)
  const [generatingCodes, setGeneratingCodes] = useState<string | null>(null)
  const [accentSaving, setAccentSaving] = useState(false)
  const [showArtistTooltip, setShowArtistTooltip] = useState(false)
  const [showMilestone, setShowMilestone] = useState(!!milestone)

  const hasPublishedContent = rels.some(r => r.published) || !!artist.bio

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

  // ── Cancel pre-order ────────────────────────────────────────
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  async function cancelPreorder(releaseId: string) {
    setCancelTarget(releaseId)
  }

  async function confirmCancel() {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cancel-preorder`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({ release_id: cancelTarget }),
        }
      )
      if (res.ok) {
        setRels(prev => prev.map(r =>
          r.id === cancelTarget ? { ...r, published: false, preorder_enabled: false } : r
        ))
      }
    } catch {}
    setCancelling(false)
    setCancelTarget(null)
  }

  // ── Logout ─────────────────────────────────────────────────
  const router = useRouter()
  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/')
  }, [supabase, router])

  return (
    <div className="min-h-screen flex bg-[#09090b] text-zinc-100">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-64 border-r border-zinc-900 p-8 hidden md:flex flex-col flex-shrink-0 sticky top-0 h-screen">
        <div className="flex items-center justify-between mb-12">
          <a href="/" className="text-2xl font-display font-bold text-orange-600 tracking-tighter hover:text-orange-500 transition-colors">insound.</a>
          <NotificationBell userId={artist.id} />
        </div>
        <nav className="space-y-1 flex-1">
          <SidebarLink href="/dashboard" label="Dashboard" active />
          <SidebarLink href="/discography" label="Discography" />
          <SidebarLink href="/sales" label="Sales & Payouts" />
          <SidebarLink href="/explore" label="Browse Store" />
        </nav>
        <div className="pt-6 border-t border-zinc-900 space-y-3">
          {fanUsername && fanIsPublic && (
            <a
              href={`/${fanUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-zinc-500 hover:text-white font-bold text-xs uppercase tracking-wider py-2 transition-colors"
            >
              View my fan profile
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
              </svg>
            </a>
          )}
          {fanUsername && !fanIsPublic && (
            <p className="text-zinc-600 text-[10px] leading-relaxed py-2">
              Your fan profile is private. <a href="/settings/profile" className="text-orange-500 hover:text-orange-400 transition-colors">Make it public</a> in Settings to see how others see you.
            </p>
          )}
          <button onClick={handleLogout} className="block text-zinc-600 hover:text-red-400 font-bold text-xs uppercase tracking-wider py-2 transition-colors">Log Out</button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto p-8 md:p-12">

          {/* Header */}
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12 gap-4">
            <div>
              <p className="text-zinc-500 text-sm font-semibold mb-1">Welcome back</p>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-display font-bold tracking-tight">{artist.name}</h1>
                <div className="relative">
                  <a
                    href={`/${artist.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-500 rounded-full ring-1 ring-white/[0.12] hover:ring-white/[0.25] hover:bg-white/[0.04] hover:text-white active:scale-[0.98] transition-all"
                    onMouseEnter={() => !hasPublishedContent && setShowArtistTooltip(true)}
                    onMouseLeave={() => setShowArtistTooltip(false)}
                  >
                    View my page
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                    </svg>
                  </a>
                  {showArtistTooltip && (
                    <div className="absolute left-0 top-full mt-2 z-50 w-64 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-xs text-zinc-300 leading-relaxed shadow-xl">
                      Your page is live but empty — upload your first release to make it shine
                    </div>
                  )}
                </div>
              </div>
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

          {/* ── Referral & Zero Fees ──────────────────────── */}
          {referral && <ReferralWidget referral={referral} />}

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
                    onCancelPreorder={cancelPreorder}
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

      {/* First sale milestone modal */}
      {showMilestone && milestone && (
        <FirstSaleMilestoneModal
          artistName={milestone.artistName}
          onClose={async () => {
            setShowMilestone(false)
            await fetch('/api/milestone/shown', { method: 'POST' })
          }}
        />
      )}

      {/* Cancel pre-order confirmation modal */}
      {cancelTarget && (() => {
        const rel = rels.find(r => r.id === cancelTarget)
        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => !cancelling && setCancelTarget(null)}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg mb-2">Cancel Pre-order</h3>
              <p className="text-zinc-400 text-sm mb-6">
                This will cancel <strong className="text-white">{rel?.title}</strong> and issue full refunds to all pre-order purchasers. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setCancelTarget(null)} disabled={cancelling} className="flex-1 text-zinc-400 font-bold text-sm py-3 rounded-full border border-zinc-800 hover:border-zinc-700 transition-colors">
                  Keep Release
                </button>
                <button onClick={confirmCancel} disabled={cancelling} className="flex-1 bg-red-600 text-white font-bold text-sm py-3 rounded-full hover:bg-red-500 transition-colors disabled:opacity-50">
                  {cancelling ? 'Cancelling...' : 'Cancel & Refund'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
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

function ReleaseRow({ release: r, artistId, artistSlug, codes, onToggle, onGenerateCodes, generatingCodes, onCancelPreorder }: {
  release: Release; artistId: string; artistSlug: string; codes?: CodeSummary
  onToggle: (id: string, field: string, value: any) => void
  onGenerateCodes: (id: string) => void; generatingCodes: boolean
  onCancelPreorder: (id: string) => void
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
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">Release Date</label>
                <input
                  type="date"
                  defaultValue={r.release_date || ''}
                  onChange={(e) => onToggle(r.id, 'release_date', e.target.value || null)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 text-sm text-white focus:border-orange-600 outline-none transition-colors"
                />
              </div>
              <button
                onClick={() => onCancelPreorder(r.id)}
                className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider"
              >
                Cancel Pre-order &amp; Refund All
              </button>
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

function ReferralWidget({ referral }: { referral: Referral }) {
  const [copied, setCopied] = useState(false)
  const shareLink = referralShareUrl(referral.code)
  const filled = Math.min(referral.count, 5)
  const zeroFees = isZeroFeesActive(referral.artistHasZeroFees, referral.zeroFeesStart)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="mb-6 space-y-4">
      {/* Zero-fees status */}
      {referral.artistHasZeroFees && (
        <div className="bg-orange-600/[0.06] border border-orange-600/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-orange-600/15 flex items-center justify-center">
              <svg width="16" height="16" fill="none" stroke="#F56D00" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-display font-bold text-sm">Zero Insound Fees</p>
          </div>
          <p className="text-sm text-zinc-400">
            {zeroFees.active
              ? `Active — ${zeroFees.monthsRemaining} month${zeroFees.monthsRemaining !== 1 ? 's' : ''} remaining`
              : zeroFees.monthsRemaining === 0
                ? `Expired${referral.zeroFeesStart ? ` (started ${new Date(referral.zeroFeesStart).toLocaleDateString()})` : ''}`
                : 'Starts with your first sale'}
          </p>
        </div>
      )}

      {/* Referral share widget */}
      <Section title="Invite Friends" count={referral.count}>
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            {referral.zeroFeesUnlocked
              ? "You've unlocked zero fees! Keep sharing to help more artists discover Insound."
              : `Invite ${5 - filled} more friend${5 - filled !== 1 ? 's' : ''} to unlock 0% Insound fees for your first year.`}
          </p>

          {/* Progress circles */}
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: i < filled ? '#F56D00' : 'rgba(255,255,255,0.08)',
                  background: i < filled ? 'rgba(245, 109, 0, 0.15)' : 'transparent',
                }}
              >
                {i < filled && (
                  <svg width="12" height="12" fill="none" stroke="#F56D00" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            ))}
            <span className="text-xs text-zinc-500 font-bold self-center ml-2">
              {filled}/5
            </span>
          </div>

          {/* Share link */}
          <div className="bg-black/30 rounded-xl p-3 flex items-center gap-3">
            <p className="text-orange-500 font-bold text-xs flex-1 truncate">{shareLink}</p>
            <button
              onClick={copyLink}
              className="shrink-0 bg-orange-600 text-black font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider hover:bg-orange-500 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Share buttons */}
          <div className="flex gap-2">
            <a href={twitterShareUrl(referral.code)} target="_blank" rel="noopener noreferrer"
              className="flex-1 bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/[0.06] rounded-lg py-2 text-center text-[10px] font-bold text-zinc-400 transition-all">
              𝕏
            </a>
            <a href={whatsappShareUrl(referral.code)} target="_blank" rel="noopener noreferrer"
              className="flex-1 bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/[0.06] rounded-lg py-2 text-center text-[10px] font-bold text-zinc-400 transition-all">
              WhatsApp
            </a>
            <a href={emailShareUrl(referral.code)}
              className="flex-1 bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/[0.06] rounded-lg py-2 text-center text-[10px] font-bold text-zinc-400 transition-all">
              Email
            </a>
          </div>
        </div>
      </Section>
    </div>
  )
}

function FirstSaleMilestoneModal({ artistName, onClose }: { artistName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const imageUrl = `/api/milestone/image?name=${encodeURIComponent(artistName)}`
  const shareText = `Just made my first sale on @getinsound! 🎶`
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent('https://getinsound.com')}`

  async function copyImage() {
    try {
      const res = await fetch(imageUrl)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      try {
        await navigator.clipboard.writeText(`${shareText}\nhttps://getinsound.com`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {}
    }
  }

  async function downloadImage() {
    const res = await fetch(imageUrl)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `insound-first-sale-${artistName.toLowerCase().replace(/\s+/g, '-')}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Milestone image */}
        <img
          src={imageUrl}
          alt={`${artistName} — First sale on Insound`}
          className="w-full aspect-[1200/630] object-cover"
        />

        <div className="p-6 space-y-5">
          <div>
            <h3 className="font-display font-bold text-xl mb-1">Congratulations!</h3>
            <p className="text-zinc-400 text-sm">You just made your first sale on Insound. Share the moment.</p>
          </div>

          {/* Share buttons */}
          <div className="flex gap-2">
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/[0.06] rounded-xl py-3 text-center text-xs font-bold text-zinc-400 transition-all"
            >
              Share on 𝕏
            </a>
            <button
              onClick={copyImage}
              className="flex-1 bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/[0.06] rounded-xl py-3 text-xs font-bold text-zinc-400 transition-all"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={downloadImage}
              className="flex-1 bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/[0.06] rounded-xl py-3 text-xs font-bold text-zinc-400 transition-all"
            >
              Download
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-orange-600 text-black font-bold py-3.5 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    </div>
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
