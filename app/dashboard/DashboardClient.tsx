'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ColourPicker } from '@/app/components/ui/ColourPicker'
import { ImageUploader } from '@/app/components/ui/ImageUploader'
import { SoftNudge } from '@/app/components/ui/SoftNudge'
import { generateGradientDataUri } from '@/lib/gradient'
import { referralShareUrl, twitterShareUrl, whatsappShareUrl, emailShareUrl } from '@/lib/referral'
import { NotificationBell } from '@/app/components/ui/NotificationBell'
import { Badge } from '@/app/components/ui/Badge'
import { PostComposer } from '@/app/components/ui/PostComposer'
import { SocialAccountsEditor } from '@/app/components/ui/SocialAccountsEditor'
import { formatPrice as formatPriceUtil } from '@/app/lib/currency'
import type { SocialLinks } from '@/lib/verification'
import { CARRIERS } from '@/lib/carriers'
import dynamic from 'next/dynamic'
const AnalyticsCharts = dynamic(() => import('./AnalyticsCharts').then(m => m.AnalyticsCharts), { ssr: false })
const StripeEmbeddedOnboarding = dynamic(() => import('./StripeEmbeddedOnboarding').then(m => m.StripeEmbeddedOnboarding), { ssr: false })

// ── Types ──────────────────────────────────────────────────────
type Artist = { id: string; slug: string; name: string; bio: string | null; avatar_url: string | null; banner_url: string | null; accent_colour: string | null; social_links: SocialLinks | null }
type Account = { id: string; email: string; stripe_account_id: string | null; stripe_onboarded: boolean }
type Track = { id: string; title: string; position: number; preview_plays: number; full_plays: number }
type Release = {
  id: string; slug: string; title: string; type: string; cover_url: string | null
  price_pence: number; published: boolean; pwyw_enabled: boolean; pwyw_minimum_pence: number | null
  preorder_enabled: boolean; release_date: string | null; visibility: string; description: string | null
  genre: string | null; created_at: string; tracks: Track[]
}
type Stats = {
  totalEarningsPence: number; monthEarningsPence: number; totalSales: number
  totalPreviewPlays: number; totalFullPlays: number; uniqueFans: number
  avgPaidPence: number; avgMinPence: number
}
type Fan = { displayEmail: string; purchaseCount: number; totalPence: number; purchases: { release_id: string; amount_pence: number; paid_at: string | null }[]; badge?: { badge_type: string; metadata?: { position?: number } | null } | null }
type CodeSummary = { total: number; redeemed: number }
type DownloadCode = {
  id: string; code: string; redeemed_by: string | null
  redeemed_at: string | null; expires_at: string; created_at: string
}

type Referral = {
  code: string; count: number
}

type Milestone = {
  artistName: string
  achievedAt: string | null
}

type MerchItem = {
  id: string; name: string; description: string; price: number; currency: string
  postage: number; stock: number; variants: string[] | null; dispatch_estimate: string
  photos: string[]; is_active: boolean; created_at: string
}

type MerchOrder = {
  id: string; fan_id: string; merch_id: string; variant_selected: string | null
  amount_paid: number; amount_paid_currency: string; shipping_address: any
  tracking_number: string | null; carrier: string | null; status: string
  created_at: string; dispatched_at: string | null; delivered_at: string | null
  return_requested_at: string | null
  merch: { name: string; photos: string[]; dispatch_estimate: string } | null
}

type Props = {
  artist: Artist; account: Account; releases: Release[]; stats: Stats
  fans: Fan[]; codesByRelease: Record<string, CodeSummary>
  fanUsername: string | null; fanIsPublic: boolean
  milestone?: Milestone
  referral?: Referral
  merchItems?: MerchItem[]
  merchOrders?: MerchOrder[]
  returnAddress?: any
  saveCounts?: Record<string, number>
  earningsHistory?: { month: string; earnings: number; sales: number }[]
  releaseBreakdown?: { releaseTitle: string; earnings: number; sales: number }[]
}

function pence(n: number) { return formatPriceUtil(n / 100, 'GBP') }

// ── Component ──────────────────────────────────────────────────
export function DashboardClient({ artist, account, releases, stats, fans, codesByRelease, fanUsername, fanIsPublic, milestone, referral, merchItems = [], merchOrders = [], returnAddress, saveCounts = {}, earningsHistory = [], releaseBreakdown = [] }: Props) {
  const supabase = createClient()
  const [rels, setRels] = useState(releases)
  const [payouts, setPayouts] = useState<any[] | null>(null)
  const [stripeBalance, setStripeBalance] = useState<{ available_pence: number; pending_pence: number } | null>(null)
  const [stripeDashUrl, setStripeDashUrl] = useState('')
  const [payoutsLoading, setPayoutsLoading] = useState(false)
  const [expandedFan, setExpandedFan] = useState<number | null>(null)
  const [generatingCodes, setGeneratingCodes] = useState<string | null>(null)
  const [codesSummary, setCodesSummary] = useState(codesByRelease)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateReleaseId, setGenerateReleaseId] = useState('')
  const [generateBatchSize, setGenerateBatchSize] = useState(10)
  const [expandedCodesRelease, setExpandedCodesRelease] = useState<string | null>(null)
  const [codesForRelease, setCodesForRelease] = useState<DownloadCode[]>([])
  const [codesLoading, setCodesLoading] = useState(false)
  const [codesFilter, setCodesFilter] = useState<'all' | 'available' | 'redeemed' | 'expired'>('all')
  const [accentSaving, setAccentSaving] = useState(false)
  const [showArtistTooltip, setShowArtistTooltip] = useState(false)
  const [showMilestone, setShowMilestone] = useState(!!milestone)
  const [artistAvatarUrl, setArtistAvatarUrl] = useState(artist.avatar_url)
  const [artistBannerUrl, setArtistBannerUrl] = useState(artist.banner_url)
  const [posts, setPosts] = useState<{ id: string; post_type: string; content: string; media_url: string | null; created_at: string }[]>([])
  const [postsLoaded, setPostsLoaded] = useState(false)
  const [deletingPost, setDeletingPost] = useState<string | null>(null)

  const [publishError, setPublishError] = useState<string | null>(null)

  // Artist name/bio editing
  const [editingProfile, setEditingProfile] = useState(false)
  const [editName, setEditName] = useState(artist.name)
  const [editBio, setEditBio] = useState(artist.bio || '')
  const [profileSaving, setProfileSaving] = useState(false)

  // Merch state
  const [merch, setMerch] = useState(merchItems)
  const [orders, setOrders] = useState(merchOrders)
  const [merchForm, setMerchForm] = useState({ name: '', description: '', price: '', postage: '0', stock: '', variants: '', dispatch_estimate: 'Ships within 5 days' })
  const [merchSaving, setMerchSaving] = useState(false)
  const [merchPhotoFiles, setMerchPhotoFiles] = useState<(File | null)[]>([null, null, null])
  const [merchPhotoPreviews, setMerchPhotoPreviews] = useState<(string | null)[]>([null, null, null])
  const [merchPhotoError, setMerchPhotoError] = useState('')
  const [uploadingPhotoFor, setUploadingPhotoFor] = useState<string | null>(null)
  const [editingMerch, setEditingMerch] = useState<string | null>(null)
  const [editMerchForm, setEditMerchForm] = useState({ name: '', description: '', price: '', postage: '', stock: '', variants: '', dispatch_estimate: '' })
  const [editMerchSaving, setEditMerchSaving] = useState(false)
  const [orderFilter, setOrderFilter] = useState('all')
  const [dispatchingOrder, setDispatchingOrder] = useState<string | null>(null)
  const [dispatchForm, setDispatchForm] = useState({ tracking_number: '', carrier: 'royal_mail' })
  const [returnAddr, setReturnAddr] = useState<any>(returnAddress || null)
  const [returnAddrForm, setReturnAddrForm] = useState({ line1: '', line2: '', city: '', postcode: '', country: 'GB' })
  const [returnAddrSaving, setReturnAddrSaving] = useState(false)
  const [showReturnAddrForm, setShowReturnAddrForm] = useState(!returnAddress)

  // Edit release modal
  const [editingRelease, setEditingRelease] = useState<Release | null>(null)


  const hasPublishedContent = rels.some(r => r.published) || !!artist.bio
  const isAllZero = stats.totalEarningsPence === 0 && stats.totalSales === 0 && stats.totalPreviewPlays === 0 && stats.totalFullPlays === 0 && stats.uniqueFans === 0

  // ── Save artist name/bio ────────────────────────────────────
  async function saveProfile() {
    const name = editName.trim()
    if (!name) return
    setProfileSaving(true)
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const { error } = await supabase.from('artists').update({ name, slug, bio: editBio.trim() || null }).eq('id', artist.id)
    if (!error) {
      artist.name = name
      artist.slug = slug
      artist.bio = editBio.trim() || null
      setEditingProfile(false)
    }
    setProfileSaving(false)
  }

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
    if (field === 'published') {
      setPublishError(null)
      const res = await fetch('/api/releases/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ release_id: releaseId, published: value }),
      })
      if (res.ok) {
        setRels(prev => prev.map(r => r.id === releaseId ? { ...r, published: value } : r))
      } else {
        const body = await res.json().catch(() => ({}))
        setPublishError(body.error || 'Failed to update publish status.')
      }
      return
    }
    const { error } = await supabase.from('releases').update({ [field]: value }).eq('id', releaseId)
    if (!error) setRels(prev => prev.map(r => r.id === releaseId ? { ...r, [field]: value } : r))
  }

  function slugify(value: string): string {
    return value.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  }

  function titleCaseGenre(g: string): string {
    return g.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  }

  async function saveRelease(updated: { title: string; description: string; genre: string; price_pence: number; coverFile?: File; tracks: { id: string; title: string; position: number }[] }) {
    if (!editingRelease) return
    const releaseId = editingRelease.id
    const newSlug = slugify(updated.title)

    if (updated.coverFile) {
      const ext = updated.coverFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const coverPath = `${artist.id}/${releaseId}.${ext}`
      const { error: coverErr } = await supabase.storage.from('covers').upload(coverPath, updated.coverFile, { contentType: updated.coverFile.type, upsert: true })
      if (!coverErr) {
        const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(coverPath)
        const coverUrl = `${publicUrl}?t=${Date.now()}`
        await supabase.from('releases').update({ cover_url: coverUrl }).eq('id', releaseId)
        setRels(prev => prev.map(r => r.id === releaseId ? { ...r, cover_url: coverUrl } : r))
      }
    }

    const { error } = await supabase.from('releases').update({
      title: updated.title.trim(),
      slug: newSlug,
      description: updated.description.trim() || null,
      genre: updated.genre.trim() ? titleCaseGenre(updated.genre) : null,
      price_pence: updated.price_pence,
    }).eq('id', releaseId)

    if (!error) {
      setRels(prev => prev.map(r => r.id === releaseId ? {
        ...r, title: updated.title.trim(), slug: newSlug,
        description: updated.description.trim() || null,
        genre: updated.genre.trim() ? titleCaseGenre(updated.genre) : null,
        price_pence: updated.price_pence,
      } : r))
    }

    for (const track of updated.tracks) {
      const original = editingRelease.tracks.find(t => t.id === track.id)
      if (original && (original.title !== track.title || original.position !== track.position)) {
        await supabase.from('tracks').update({ title: track.title.trim(), position: track.position }).eq('id', track.id)
        setRels(prev => prev.map(r => r.id === releaseId ? {
          ...r, tracks: r.tracks.map(t => t.id === track.id ? { ...t, title: track.title.trim(), position: track.position } : t)
        } : r))
      }
    }

    setEditingRelease(null)
  }

  // ── Download codes ──────────────────────────────────────────
  async function generateCodes(releaseId: string, count: number) {
    setGeneratingCodes(releaseId)
    try {
      const res = await fetch('/api/dashboard/download-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ release_id: releaseId, count }),
      })
      if (res.ok) {
        const data = await res.json()
        const generated = data.count || 0
        setCodesSummary(prev => {
          const existing = prev[releaseId] || { total: 0, redeemed: 0 }
          return { ...prev, [releaseId]: { total: existing.total + generated, redeemed: existing.redeemed } }
        })
        if (expandedCodesRelease === releaseId) loadCodesForRelease(releaseId)
      }
    } catch (err) { console.error('Operation failed:', err) }
    setGeneratingCodes(null)
    setShowGenerateModal(false)
  }

  async function loadCodesForRelease(releaseId: string) {
    setCodesLoading(true)
    try {
      const res = await fetch(`/api/dashboard/download-codes?release_id=${releaseId}`)
      if (res.ok) {
        const data = await res.json()
        setCodesForRelease(data.codes || [])
        setCodesSummary(prev => ({ ...prev, [releaseId]: { total: data.total, redeemed: data.redeemed } }))
      }
    } catch (err) { console.error('Operation failed:', err) }
    setCodesLoading(false)
  }

  function toggleCodesExpand(releaseId: string) {
    if (expandedCodesRelease === releaseId) {
      setExpandedCodesRelease(null)
      setCodesForRelease([])
      setCodesFilter('all')
    } else {
      setExpandedCodesRelease(releaseId)
      setCodesFilter('all')
      loadCodesForRelease(releaseId)
    }
  }

  function downloadCodesCSV(releaseId: string) {
    const rel = rels.find(r => r.id === releaseId)
    const now = new Date()
    const rows = [['Code', 'Status', 'Redeemed By', 'Redeemed At', 'Expires At', 'Created At']]
    for (const c of codesForRelease) {
      const expired = new Date(c.expires_at) < now
      const status = c.redeemed_by ? 'Redeemed' : expired ? 'Expired' : 'Available'
      rows.push([c.code, status, c.redeemed_by || '', c.redeemed_at ? new Date(c.redeemed_at).toLocaleDateString() : '', new Date(c.expires_at).toLocaleDateString(), new Date(c.created_at).toLocaleDateString()])
    }
    const csv = rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(rel?.title || 'codes').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-download-codes.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // ── Accent colour save ─────────────────────────────────────
  async function saveAccent(colour: string) {
    setAccentSaving(true)
    await supabase.from('artists').update({ accent_colour: colour }).eq('id', artist.id)
    setAccentSaving(false)
  }

  // ── Posts ───────────────────────────────────────────────────
  async function loadPosts() {
    if (postsLoaded) return
    const res = await fetch('/api/posts')
    const data = await res.json().catch(() => ({ posts: [] }))
    setPosts(data.posts || [])
    setPostsLoaded(true)
  }

  async function deletePost(postId: string) {
    setDeletingPost(postId)
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
      if (res.ok) setPosts(prev => prev.filter(p => p.id !== postId))
    } catch (err) { console.error('Operation failed:', err) }
    setDeletingPost(null)
  }

  // ── Artist avatar upload ────────────────────────────────────
  async function handleArtistAvatarUpload(file: File) {
    const { data: existing } = await supabase.storage.from('avatars').list(artist.id)
    if (existing?.length) {
      await supabase.storage.from('avatars').remove(existing.map(f => `${artist.id}/${f.name}`))
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${artist.id}/avatar.${ext}`
    const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadErr) throw new Error(uploadErr.message)
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = `${publicUrl}?t=${Date.now()}`
    await supabase.from('artists').update({ avatar_url: url }).eq('id', artist.id)
    setArtistAvatarUrl(url)
  }

  async function handleArtistAvatarRemove() {
    const { data: existing } = await supabase.storage.from('avatars').list(artist.id)
    if (existing?.length) {
      await supabase.storage.from('avatars').remove(existing.map(f => `${artist.id}/${f.name}`))
    }
    await supabase.from('artists').update({ avatar_url: null }).eq('id', artist.id)
    setArtistAvatarUrl(null)
  }

  // ── Artist banner upload ───────────────────────────────────
  async function handleBannerUpload(file: File) {
    const { data: existing } = await supabase.storage.from('banners').list(artist.id)
    if (existing?.length) {
      await supabase.storage.from('banners').remove(existing.map(f => `${artist.id}/${f.name}`))
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${artist.id}/banner.${ext}`
    const { error: uploadErr } = await supabase.storage.from('banners').upload(path, file, { upsert: true })
    if (uploadErr) throw new Error(uploadErr.message)
    const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(path)
    const url = `${publicUrl}?t=${Date.now()}`
    await supabase.from('artists').update({ banner_url: url }).eq('id', artist.id)
    setArtistBannerUrl(url)
  }

  async function handleBannerRemove() {
    const { data: existing } = await supabase.storage.from('banners').list(artist.id)
    if (existing?.length) {
      await supabase.storage.from('banners').remove(existing.map(f => `${artist.id}/${f.name}`))
    }
    await supabase.from('artists').update({ banner_url: null }).eq('id', artist.id)
    setArtistBannerUrl(null)
  }

  // ── Cancel pre-order ────────────────────────────────────────
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // ── Escape key for modals ───────────────────────────────────
  useEffect(() => {
    if (!showGenerateModal && !cancelTarget) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showGenerateModal && !generatingCodes) setShowGenerateModal(false)
        if (cancelTarget && !cancelling) setCancelTarget(null)
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [showGenerateModal, generatingCodes, cancelTarget, cancelling])

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
    } catch (err) { console.error('Operation failed:', err) }
    setCancelling(false)
    setCancelTarget(null)
  }

  // ── Merch handlers ─────────────────────────────────────────
  async function saveReturnAddress() {
    setReturnAddrSaving(true)
    try {
      const res = await fetch('/api/return-address', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ return_address: returnAddrForm }),
      })
      if (res.ok) {
        setReturnAddr(returnAddrForm)
        setShowReturnAddrForm(false)
      }
    } catch (err) { console.error('Operation failed:', err) }
    setReturnAddrSaving(false)
  }

  function handleMerchPhotoSelect(slot: number, file: File | null) {
    setMerchPhotoError('')
    if (!file) {
      setMerchPhotoFiles(prev => { const n = [...prev]; n[slot] = null; return n })
      setMerchPhotoPreviews(prev => { const n = [...prev]; n[slot] = null; return n })
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMerchPhotoError('Only JPEG, PNG, and WebP images are allowed')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setMerchPhotoError('Image must be under 5MB')
      return
    }
    setMerchPhotoFiles(prev => { const n = [...prev]; n[slot] = file; return n })
    setMerchPhotoPreviews(prev => { const n = [...prev]; n[slot] = URL.createObjectURL(file); return n })
  }

  async function uploadPhotoToMerch(merchId: string, file: File): Promise<string[]> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/merch/${merchId}/photos`, { method: 'POST', body: fd })
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Upload failed') }
    const data = await res.json()
    return data.photos
  }

  async function createMerchItem() {
    if (!returnAddr || !merchPhotoFiles[0]) return
    setMerchSaving(true)
    try {
      const variantsArr = merchForm.variants.trim()
        ? merchForm.variants.split(',').map(v => v.trim()).filter(Boolean)
        : null
      const res = await fetch('/api/merch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: merchForm.name,
          description: merchForm.description,
          price: Math.round(parseFloat(merchForm.price) * 100),
          currency: 'GBP',
          postage: Math.round(parseFloat(merchForm.postage || '0') * 100),
          stock: parseInt(merchForm.stock, 10),
          variants: variantsArr,
          dispatch_estimate: merchForm.dispatch_estimate,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        let photos: string[] = []
        for (const file of merchPhotoFiles) {
          if (file) photos = await uploadPhotoToMerch(data.id, file)
        }
        setMerch(prev => [{ ...data, name: merchForm.name, description: merchForm.description, price: Math.round(parseFloat(merchForm.price) * 100), currency: 'GBP', postage: Math.round(parseFloat(merchForm.postage || '0') * 100), stock: parseInt(merchForm.stock), variants: variantsArr, dispatch_estimate: merchForm.dispatch_estimate, photos, is_active: true, created_at: new Date().toISOString() }, ...prev])
        setMerchForm({ name: '', description: '', price: '', postage: '0', stock: '', variants: '', dispatch_estimate: 'Ships within 5 days' })
        setMerchPhotoFiles([null, null, null])
        setMerchPhotoPreviews([null, null, null])
      }
    } catch (err) { console.error('Operation failed:', err) }
    setMerchSaving(false)
  }

  function startEditMerch(m: MerchItem) {
    setEditingMerch(m.id)
    setEditMerchForm({
      name: m.name,
      description: m.description,
      price: (m.price / 100).toFixed(2),
      postage: (m.postage / 100).toFixed(2),
      stock: String(m.stock),
      variants: m.variants?.join(', ') ?? '',
      dispatch_estimate: m.dispatch_estimate,
    })
  }

  async function saveEditMerch() {
    if (!editingMerch) return
    setEditMerchSaving(true)
    try {
      const variantsArr = editMerchForm.variants.trim()
        ? editMerchForm.variants.split(',').map(v => v.trim()).filter(Boolean)
        : null
      const updates = {
        name: editMerchForm.name,
        description: editMerchForm.description,
        price: Math.round(parseFloat(editMerchForm.price) * 100),
        postage: Math.round(parseFloat(editMerchForm.postage || '0') * 100),
        stock: parseInt(editMerchForm.stock, 10),
        variants: variantsArr,
        dispatch_estimate: editMerchForm.dispatch_estimate,
      }
      const res = await fetch(`/api/merch/${editingMerch}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        setMerch(prev => prev.map(m => m.id === editingMerch ? { ...m, ...updates } : m))
        setEditingMerch(null)
      }
    } catch (err) { console.error('Operation failed:', err) }
    setEditMerchSaving(false)
  }

  async function replaceMerchPhoto(merchId: string, index: number, file: File) {
    setUploadingPhotoFor(merchId)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/merch/${merchId}/photos?index=${index}`, { method: 'PUT', body: fd })
      if (res.ok) {
        const data = await res.json()
        setMerch(prev => prev.map(m => m.id === merchId ? { ...m, photos: data.photos } : m))
      }
    } catch (err) { console.error('Operation failed:', err) }
    setUploadingPhotoFor(null)
  }

  async function removeMerchPhoto(merchId: string, index: number) {
    if (index === 0) return
    setUploadingPhotoFor(merchId)
    try {
      const res = await fetch(`/api/merch/${merchId}/photos?index=${index}`, { method: 'DELETE' })
      if (res.ok) {
        const data = await res.json()
        setMerch(prev => prev.map(m => m.id === merchId ? { ...m, photos: data.photos } : m))
      }
    } catch (err) { console.error('Operation failed:', err) }
    setUploadingPhotoFor(null)
  }

  async function toggleMerchActive(id: string, isActive: boolean) {
    await fetch(`/api/merch/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    })
    setMerch(prev => prev.map(m => m.id === id ? { ...m, is_active: !isActive } : m))
  }

  async function dispatchOrder(orderId: string) {
    const res = await fetch(`/api/orders/${orderId}/dispatch`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dispatchForm),
    })
    if (res.ok) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'dispatched', tracking_number: dispatchForm.tracking_number, carrier: dispatchForm.carrier, dispatched_at: new Date().toISOString() } : o))
      setDispatchingOrder(null)
      setDispatchForm({ tracking_number: '', carrier: 'royal_mail' })
    }
  }

  async function markDelivered(orderId: string) {
    if (!window.confirm('Mark this order as delivered?')) return
    const res = await fetch(`/api/orders/${orderId}/deliver`, { method: 'PATCH' })
    if (res.ok) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'delivered', delivered_at: new Date().toISOString() } : o))
    }
  }

  async function confirmReturn(orderId: string) {
    if (!window.confirm('Confirm this return and issue a refund? This cannot be undone.')) return
    const res = await fetch(`/api/orders/${orderId}/confirm-return`, { method: 'PATCH' })
    if (res.ok) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'returned' } : o))
    }
  }

  const filteredOrders = orderFilter === 'all' ? orders : orders.filter(o => o.status === orderFilter)

  // ── Logout ─────────────────────────────────────────────────
  const router = useRouter()
  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/')
  }, [supabase, router])

  return (
    <div className="min-h-screen flex bg-insound-bg text-zinc-100">
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
          <SidebarLink href="/explore" label="Explore" />
        </nav>
        <div className="pt-6 border-t border-zinc-900 space-y-3">
          {fanUsername && fanIsPublic && (
            <a
              href={`/@${fanUsername}`}
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
          {(!fanUsername || !fanIsPublic) && (
            <a
              href="/settings/profile"
              className="flex items-center gap-2 text-zinc-500 hover:text-white font-bold text-xs uppercase tracking-wider py-2 transition-colors"
            >
              Fan Profile
            </a>
          )}
          <button onClick={handleLogout} className="block text-zinc-600 hover:text-red-400 font-bold text-xs uppercase tracking-wider py-2 transition-colors">Log Out</button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto p-8 md:p-12">

          {/* Header */}
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
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
                      Your page is live but empty - upload your first release to make it shine
                    </div>
                  )}
                </div>
              </div>
            </div>
            {account.stripe_onboarded ? (
              <Link href="/discography" className="bg-orange-600 text-black font-bold px-7 py-3.5 rounded-xl hover:bg-orange-500 transition-colors shadow-lg shadow-orange-600/20 text-sm uppercase tracking-wider flex items-center gap-2 shrink-0">
                + Upload Track
              </Link>
            ) : (
              <span className="bg-zinc-700 text-zinc-500 cursor-not-allowed font-bold px-7 py-3.5 rounded-xl text-sm uppercase tracking-wider flex items-center gap-2 shrink-0" title="Set up payouts first">
                + Upload Track
              </span>
            )}
          </header>

          {/* ── Stripe Setup Banner ────────────────────── */}
          {!account.stripe_onboarded && (
            <div className="bg-gradient-to-br from-orange-600/10 via-zinc-900 to-zinc-900 border border-orange-600/20 rounded-2xl p-8 mb-10">
              <h2 className="font-display text-2xl font-bold tracking-tight mb-2">
                {rels.some(r => r.published) ? 'Set up payouts to start earning' : 'Set up payouts'}
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed max-w-lg">
                {rels.some(r => r.published)
                  ? 'You have published releases but can\'t receive payments yet. Complete your payout setup so fans can buy your music.'
                  : 'Connect your bank account so you can get paid when fans buy your music. This takes about 2 minutes.'}
              </p>
              <StripeEmbeddedOnboarding
                stripeAccountId={account.stripe_account_id}
                onComplete={() => window.location.reload()}
              />
            </div>
          )}

          {/* ── Welcome Banner (all zero) ──────────────── */}
          {isAllZero && account.stripe_onboarded && (
            <div className="bg-gradient-to-br from-orange-600/10 via-zinc-900 to-zinc-900 border border-orange-600/20 rounded-2xl p-8 mb-10">
              <h2 className="font-display text-2xl font-bold tracking-tight mb-2">Welcome to Insound</h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-5 max-w-lg">
                Your artist page is live. Upload your first release to start selling - your stats will appear here once fans find you.
              </p>
              <Link href="/discography" className="inline-flex items-center gap-2 bg-orange-600 text-black font-bold text-sm px-5 py-3 rounded-xl hover:bg-orange-500 transition-colors shadow-lg shadow-orange-600/20">
                + Upload your first release
              </Link>
            </div>
          )}

          {/* ── 1. Stats ───────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <StatBox label="Lifetime Earnings" value={pence(stats.totalEarningsPence)} sub={`${pence(stats.monthEarningsPence)} this month`} />
            <StatBox label="Total Sales" value={String(stats.totalSales)} />
            <StatBox label="Plays" value={String(stats.totalPreviewPlays + stats.totalFullPlays)} sub={`${stats.totalPreviewPlays} preview · ${stats.totalFullPlays} full`} />
            <StatBox label="Unique Fans" value={String(stats.uniqueFans)} />
          </div>
          <AnalyticsCharts earningsHistory={earningsHistory} releaseBreakdown={releaseBreakdown} />
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
          {publishError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-3 mb-4">
              <p className="text-sm font-bold text-red-400">{publishError}</p>
            </div>
          )}
          <Section title="Releases" count={rels.length}>
            {rels.length === 0 ? (
              <p className="text-zinc-600 text-sm py-10 text-center">No releases yet.</p>
            ) : (
              <div className="space-y-3">
                {rels.map(r => {
                  const relSaves = saveCounts[`release:${r.id}`] || 0
                  const trkSaves = r.tracks.reduce((s, t) => s + (saveCounts[`track:${t.id}`] || 0), 0)
                  return (
                    <ReleaseRow
                      key={r.id}
                      release={r}
                      artistId={artist.id}
                      artistSlug={artist.slug}
                      onToggle={toggleField}
                      onCancelPreorder={cancelPreorder}
                      onEdit={setEditingRelease}
                      saveCount={relSaves + trkSaves}
                    />
                  )
                })}
              </div>
            )}
          </Section>

          {/* ── Merch Listings ───────────────��────────────── */}
          <Section title="Merch" count={merch.filter(m => m.is_active).length}>
            {/* Return address */}
            {showReturnAddrForm && (
              <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 mb-6">
                <p className="text-xs font-bold text-zinc-400 mb-3">Return address (required before listing merch)</p>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Address line 1" value={returnAddrForm.line1} onChange={e => setReturnAddrForm(f => ({ ...f, line1: e.target.value }))} className="col-span-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="Line 2 (optional)" value={returnAddrForm.line2} onChange={e => setReturnAddrForm(f => ({ ...f, line2: e.target.value }))} className="col-span-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="City" value={returnAddrForm.city} onChange={e => setReturnAddrForm(f => ({ ...f, city: e.target.value }))} className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="Postcode" value={returnAddrForm.postcode} onChange={e => setReturnAddrForm(f => ({ ...f, postcode: e.target.value }))} className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
                </div>
                <button onClick={saveReturnAddress} disabled={returnAddrSaving || !returnAddrForm.line1 || !returnAddrForm.city || !returnAddrForm.postcode} className="mt-3 bg-orange-600 text-black font-bold px-4 py-2 rounded-lg text-xs disabled:opacity-40">
                  {returnAddrSaving ? 'Saving...' : 'Save Address'}
                </button>
              </div>
            )}

            {returnAddr && (
              <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-zinc-400">New merch listing</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Name" value={merchForm.name} onChange={e => setMerchForm(f => ({ ...f, name: e.target.value }))} className="col-span-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
                  <textarea placeholder="Description" value={merchForm.description} onChange={e => setMerchForm(f => ({ ...f, description: e.target.value }))} className="col-span-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm h-20 resize-none" />
                  <input placeholder="Price (£)" type="number" step="0.01" min="3" value={merchForm.price} onChange={e => setMerchForm(f => ({ ...f, price: e.target.value }))} className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="Postage (£)" type="number" step="0.01" min="0" value={merchForm.postage} onChange={e => setMerchForm(f => ({ ...f, postage: e.target.value }))} className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="Stock" type="number" min="1" value={merchForm.stock} onChange={e => setMerchForm(f => ({ ...f, stock: e.target.value }))} className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="Variants (S, M, L, XL)" value={merchForm.variants} onChange={e => setMerchForm(f => ({ ...f, variants: e.target.value }))} className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="Dispatch estimate" value={merchForm.dispatch_estimate} onChange={e => setMerchForm(f => ({ ...f, dispatch_estimate: e.target.value }))} className="col-span-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
                  <div className="col-span-2">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Product photos</p>
                    <div className="flex gap-3">
                      {[0, 1, 2].map(slot => (
                        <div key={slot} className="flex flex-col items-center gap-1">
                          {merchPhotoPreviews[slot] ? (
                            <div className="relative group">
                              <img src={merchPhotoPreviews[slot]!} alt={`Photo ${slot + 1}`} className="w-16 h-16 rounded-lg object-cover" />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
                                <label className="cursor-pointer p-1">
                                  <svg width="12" height="12" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { handleMerchPhotoSelect(slot, e.target.files?.[0] || null); e.target.value = '' }} />
                                </label>
                                {slot > 0 && (
                                  <button onClick={() => handleMerchPhotoSelect(slot, null)} className="p-1">
                                    <svg width="12" height="12" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <label className="flex items-center justify-center w-16 h-16 border border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-zinc-500 transition-colors">
                              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-zinc-600"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { handleMerchPhotoSelect(slot, e.target.files?.[0] || null); e.target.value = '' }} />
                            </label>
                          )}
                          <span className="text-[9px] text-zinc-600 font-bold">{slot === 0 ? 'Image 1 *' : `Image ${slot + 1}`}</span>
                        </div>
                      ))}
                    </div>
                    {merchPhotoError && <p className="text-xs text-red-400 mt-1">{merchPhotoError}</p>}
                  </div>
                </div>
                <button onClick={createMerchItem} disabled={merchSaving || !merchForm.name || !merchForm.price || !merchForm.stock || !merchPhotoFiles[0]} className="mt-3 bg-orange-600 text-black font-bold px-4 py-2 rounded-lg text-xs disabled:opacity-40">
                  {merchSaving ? 'Creating...' : '+ Add Listing'}
                </button>
              </div>
            )}

            {merch.length === 0 ? (
              <p className="text-zinc-600 text-sm py-6 text-center">No merch listings yet.</p>
            ) : (
              <div className="space-y-3">
                {merch.map(m => (
                  <div key={m.id}>
                  <div className="bg-zinc-900/80 border border-zinc-800/60 rounded-xl p-4">
                    <div className="flex items-center gap-4">
                    <div className="flex gap-1.5 shrink-0">
                      {[0, 1, 2].map(idx => {
                        const photo = m.photos?.[idx]
                        const canAdd = !photo && idx === (m.photos?.length || 0) && (m.photos?.length || 0) < 3
                        if (!photo && !canAdd) return <div key={idx} className="w-12 h-12" />
                        return (
                          <div key={idx} className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden shrink-0 relative group">
                            {photo ? (
                              <>
                                <img src={photo} alt={`${m.name} photo ${idx + 1}`} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                                  <label className="cursor-pointer p-0.5">
                                    <svg width="10" height="10" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploadingPhotoFor === m.id} onChange={e => {
                                      const f = e.target.files?.[0]
                                      if (!f) return
                                      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return
                                      if (f.size > 5 * 1024 * 1024) return
                                      replaceMerchPhoto(m.id, idx, f)
                                      e.target.value = ''
                                    }} />
                                  </label>
                                  {idx > 0 && (
                                    <button onClick={() => removeMerchPhoto(m.id, idx)} className="p-0.5">
                                      <svg width="10" height="10" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
                                    </button>
                                  )}
                                </div>
                              </>
                            ) : canAdd ? (
                              <label className="w-full h-full flex items-center justify-center text-zinc-700 hover:text-zinc-400 transition-colors cursor-pointer">
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploadingPhotoFor === m.id} onChange={e => {
                                  const f = e.target.files?.[0]
                                  if (!f) return
                                  if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return
                                  if (f.size > 5 * 1024 * 1024) return
                                  uploadPhotoToMerch(m.id, f).then(photos => setMerch(prev => prev.map(x => x.id === m.id ? { ...x, photos } : x)))
                                  e.target.value = ''
                                }} />
                              </label>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{m.name}</p>
                      <p className="text-[10px] text-zinc-500">
                        {pence(m.price)} · {m.stock} in stock{m.variants ? ` · ${(m.variants as string[]).join(', ')}` : ''}
                        {uploadingPhotoFor === m.id && <span className="text-orange-500 ml-1">Uploading...</span>}
                        {!m.photos?.length && uploadingPhotoFor !== m.id && <span className="text-red-400 ml-1">No photo</span>}
                        {(m.photos?.length || 0) >= 1 && <span className="text-zinc-600 ml-1">· {m.photos.length}/3 photos</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.is_active ? 'bg-green-900/50 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <button onClick={() => toggleMerchActive(m.id, m.is_active)} className="text-[10px] text-zinc-500 hover:text-orange-500 font-bold transition-colors">
                        {m.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => editingMerch === m.id ? setEditingMerch(null) : startEditMerch(m)} className="text-[10px] text-zinc-500 hover:text-orange-500 font-bold transition-colors">
                        {editingMerch === m.id ? 'Cancel' : 'Edit'}
                      </button>
                    </div>
                    </div>
                  </div>
                  {editingMerch === m.id && (
                    <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-xl p-4 mt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <input placeholder="Name" value={editMerchForm.name} onChange={e => setEditMerchForm(f => ({ ...f, name: e.target.value }))} className="col-span-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
                        <textarea placeholder="Description" value={editMerchForm.description} onChange={e => setEditMerchForm(f => ({ ...f, description: e.target.value }))} className="col-span-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm h-20 resize-none" />
                        <input placeholder="Price (£)" type="number" step="0.01" min="3" value={editMerchForm.price} onChange={e => setEditMerchForm(f => ({ ...f, price: e.target.value }))} className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
                        <input placeholder="Postage (£)" type="number" step="0.01" min="0" value={editMerchForm.postage} onChange={e => setEditMerchForm(f => ({ ...f, postage: e.target.value }))} className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
                        <input placeholder="Stock" type="number" min="0" value={editMerchForm.stock} onChange={e => setEditMerchForm(f => ({ ...f, stock: e.target.value }))} className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
                        <input placeholder="Variants (S, M, L, XL)" value={editMerchForm.variants} onChange={e => setEditMerchForm(f => ({ ...f, variants: e.target.value }))} className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
                        <input placeholder="Dispatch estimate" value={editMerchForm.dispatch_estimate} onChange={e => setEditMerchForm(f => ({ ...f, dispatch_estimate: e.target.value }))} className="col-span-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <button onClick={saveEditMerch} disabled={editMerchSaving || !editMerchForm.name || !editMerchForm.price || !editMerchForm.stock} className="mt-3 bg-orange-600 text-black font-bold px-4 py-2 rounded-lg text-xs disabled:opacity-40">
                        {editMerchSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── Merch Orders ──────────────────────────────── */}
          <Section title="Orders" count={orders.length}>
            <div className="flex gap-2 mb-4 flex-wrap">
              {['all', 'pending', 'dispatched', 'delivered', 'return_requested', 'returned', 'refunded'].map(s => (
                <button key={s} onClick={() => setOrderFilter(s)} className={`text-[10px] font-bold px-3 py-1 rounded-full transition-colors ${orderFilter === s ? 'bg-orange-600 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
                  {s === 'all' ? 'All' : s.replace('_', ' ')}
                </button>
              ))}
            </div>
            {filteredOrders.length === 0 ? (
              <p className="text-zinc-600 text-sm py-6 text-center">No orders{orderFilter !== 'all' ? ` with status "${orderFilter.replace('_', ' ')}"` : ''}.</p>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map(o => {
                  const merchData = Array.isArray(o.merch) ? o.merch[0] : o.merch
                  const photo = merchData?.photos?.[0]
                  return (
                    <div key={o.id} className="bg-zinc-900/80 border border-zinc-800/60 rounded-xl p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                          {photo ? <img src={photo} alt={merchData?.name || 'Order item'} className="w-full h-full object-cover" /> : <div className="w-full h-full" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{merchData?.name || 'Unknown item'}{o.variant_selected ? ` (${o.variant_selected})` : ''}</p>
                          <p className="text-[10px] text-zinc-500">{pence(o.amount_paid)} · {new Date(o.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          o.status === 'pending' ? 'bg-zinc-800 text-zinc-400' :
                          o.status === 'dispatched' ? 'bg-blue-900/50 text-blue-400' :
                          o.status === 'delivered' ? 'bg-green-900/50 text-green-400' :
                          o.status === 'return_requested' ? 'bg-yellow-900/50 text-yellow-400' :
                          o.status === 'returned' ? 'bg-purple-900/50 text-purple-400' :
                          o.status === 'refunded' ? 'bg-red-900/50 text-red-400' :
                          'bg-zinc-800 text-zinc-500'
                        }`}>
                          {o.status.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Dispatch form */}
                      {o.status === 'pending' && dispatchingOrder !== o.id && (
                        <button onClick={() => setDispatchingOrder(o.id)} className="mt-3 text-[10px] font-bold text-orange-500 hover:text-orange-400">
                          Mark as dispatched
                        </button>
                      )}
                      {o.status === 'pending' && dispatchingOrder === o.id && (
                        <div className="mt-3 flex gap-2 items-end">
                          <input placeholder="Tracking number" value={dispatchForm.tracking_number} onChange={e => setDispatchForm(f => ({ ...f, tracking_number: e.target.value }))} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs flex-1" />
                          <select value={dispatchForm.carrier} onChange={e => setDispatchForm(f => ({ ...f, carrier: e.target.value }))} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs">
                            {CARRIERS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                          <button onClick={() => dispatchOrder(o.id)} disabled={!dispatchForm.tracking_number} className="bg-orange-600 text-black font-bold px-3 py-1.5 rounded-lg text-xs disabled:opacity-40">
                            Dispatch
                          </button>
                          <button onClick={() => setDispatchingOrder(null)} className="text-zinc-500 text-xs font-bold">Cancel</button>
                        </div>
                      )}

                      {o.status === 'dispatched' && (
                        <button onClick={() => markDelivered(o.id)} className="mt-3 text-[10px] font-bold text-green-500 hover:text-green-400">
                          Mark as delivered
                        </button>
                      )}

                      {o.status === 'return_requested' && (
                        <button onClick={() => confirmReturn(o.id)} className="mt-3 text-[10px] font-bold text-purple-500 hover:text-purple-400">
                          Confirm return & refund
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {/* ── Post to Supporters ─────────────────────────── */}
          <Section title="Post to your supporters">
            <PostComposer
              artistId={artist.id}
              artistName={artist.name}
              onPostCreated={(post) => {
                setPosts(prev => [post, ...prev])
                setPostsLoaded(true)
              }}
            />
            {!postsLoaded ? (
              <button onClick={loadPosts} className="mt-4 text-sm text-orange-500 hover:text-orange-400 font-bold transition-colors">
                Load previous posts
              </button>
            ) : posts.length > 0 ? (
              <div className="mt-5 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Previous posts</p>
                {posts.map(p => (
                  <div key={p.id} className="flex items-start gap-4 bg-black/20 rounded-xl p-4 ring-1 ring-white/[0.04]">
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-zinc-600">{new Date(p.created_at).toLocaleDateString()}</span>
                      <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap line-clamp-3 mt-1">{p.content}</p>
                    </div>
                    <button
                      onClick={() => deletePost(p.id)}
                      disabled={deletingPost === p.id}
                      className="shrink-0 text-zinc-600 hover:text-red-400 disabled:opacity-50 transition-colors p-1"
                      title="Delete post"
                    >
                      {deletingPost === p.id ? (
                        <span className="text-[10px] text-zinc-500">...</span>
                      ) : (
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : postsLoaded ? (
              <p className="mt-4 text-zinc-600 text-sm">No posts yet. Share your first update with your fans.</p>
            ) : null}
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
                      <td className="py-3 text-zinc-400">{p.arrival_date ? new Date(p.arrival_date).toLocaleDateString() : '-'}</td>
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
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold">{fan.displayEmail}</p>
                            {fan.badge && <Badge type={fan.badge.badge_type} position={fan.badge.metadata?.position} size="xs" />}
                          </div>
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
                  : 'Complete payout setup above to start selling'}
              </p>
            </div>
            {account.stripe_onboarded && stripeDashUrl && (
              <a href={stripeDashUrl} target="_blank" rel="noopener noreferrer"
                className="mt-4 inline-block text-sm text-orange-500 hover:text-orange-400 font-bold transition-colors">
                Open Stripe Express Dashboard &rarr;
              </a>
            )}
          </Section>

          {/* ── 6. Download Codes ──────────────────────────── */}
          <Section title="Download Codes">
            {rels.length === 0 ? (
              <p className="text-zinc-600 text-sm">Upload a release to generate download codes.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => { setGenerateReleaseId(rels[0].id); setGenerateBatchSize(10); setShowGenerateModal(true) }}
                    className="bg-orange-600 text-black font-bold px-4 py-2 rounded-lg text-xs uppercase tracking-wider hover:bg-orange-500 transition-colors"
                  >
                    + Generate Codes
                  </button>
                </div>
                {rels.map(r => {
                  const c = codesSummary[r.id]
                  const isExpanded = expandedCodesRelease === r.id
                  const remaining = c ? c.total - c.redeemed : 0
                  const now = new Date()

                  const filteredCodes = codesForRelease.filter(code => {
                    if (codesFilter === 'all') return true
                    const expired = new Date(code.expires_at) < now
                    if (codesFilter === 'redeemed') return !!code.redeemed_by
                    if (codesFilter === 'expired') return expired && !code.redeemed_by
                    return !code.redeemed_by && !expired
                  })

                  return (
                    <div key={r.id} className="bg-zinc-900/80 border border-zinc-800/60 rounded-xl overflow-hidden">
                      <button
                        onClick={() => c && c.total > 0 ? toggleCodesExpand(r.id) : undefined}
                        className="w-full flex items-center gap-4 p-4 text-left hover:bg-zinc-800/30 transition-colors"
                      >
                        <img src={r.cover_url || generateGradientDataUri(artist.id, r.id)} alt={r.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{r.title}</p>
                          {c && c.total > 0 ? (
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] text-zinc-500">{c.total} generated</span>
                              <span className="text-[10px] text-green-500">{c.redeemed} redeemed</span>
                              <span className="text-[10px] text-orange-500">{remaining} remaining</span>
                            </div>
                          ) : (
                            <p className="text-[10px] text-zinc-600 mt-1">No codes generated</p>
                          )}
                        </div>
                        {c && c.total > 0 && (
                          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className={`shrink-0 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="border-t border-zinc-800/40 p-4">
                          {codesLoading ? (
                            <p className="text-zinc-500 text-sm text-center py-4">Loading codes...</p>
                          ) : (
                            <>
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex gap-1.5 flex-wrap">
                                  {(['all', 'available', 'redeemed', 'expired'] as const).map(f => (
                                    <button
                                      key={f}
                                      onClick={() => setCodesFilter(f)}
                                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors ${codesFilter === f ? 'bg-orange-600 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                                    >
                                      {f.charAt(0).toUpperCase() + f.slice(1)}
                                    </button>
                                  ))}
                                </div>
                                <button
                                  onClick={() => downloadCodesCSV(r.id)}
                                  className="text-[10px] font-bold text-orange-500 hover:text-orange-400 transition-colors flex items-center gap-1"
                                >
                                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                  CSV
                                </button>
                              </div>

                              {filteredCodes.length === 0 ? (
                                <p className="text-zinc-600 text-sm text-center py-3">No codes match this filter.</p>
                              ) : (
                                <div className="space-y-1 max-h-72 overflow-y-auto">
                                  {filteredCodes.map(code => {
                                    const expired = new Date(code.expires_at) < now
                                    const status = code.redeemed_by ? 'redeemed' : expired ? 'expired' : 'available'
                                    return (
                                      <div key={code.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-zinc-800/30">
                                        <code className="text-xs font-mono text-zinc-300 flex-shrink-0">{code.code}</code>
                                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                                          status === 'available' ? 'bg-green-900/50 text-green-400' :
                                          status === 'redeemed' ? 'bg-blue-900/50 text-blue-400' :
                                          'bg-zinc-800 text-zinc-500'
                                        }`}>
                                          {status}
                                        </span>
                                        <span className="text-[10px] text-zinc-600 flex-1 min-w-0 truncate">
                                          {code.redeemed_by
                                            ? `${maskId(code.redeemed_by)} · ${new Date(code.redeemed_at!).toLocaleDateString()}`
                                            : `expires ${new Date(code.expires_at).toLocaleDateString()}`
                                          }
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {/* ── Name & Bio ─────────────────────────────── */}
          <Section title="Name & Bio">
            {editingProfile ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 block mb-2">Artist Name</label>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-sm text-white focus:border-orange-600 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 block mb-2">Bio</label>
                  <textarea
                    value={editBio}
                    onChange={e => setEditBio(e.target.value)}
                    maxLength={500}
                    rows={4}
                    placeholder="Tell fans about yourself..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-sm text-white placeholder-zinc-700 focus:border-orange-600 outline-none transition-colors resize-none"
                  />
                  <p className="text-right text-[10px] text-zinc-600 mt-1">{editBio.length}/500</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setEditName(artist.name); setEditBio(artist.bio || ''); setEditingProfile(false) }}
                    className="px-5 py-2.5 text-sm font-bold text-zinc-400 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={profileSaving || !editName.trim()}
                    className="px-5 py-2.5 text-sm font-bold text-black bg-orange-600 hover:bg-orange-500 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {profileSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="font-bold text-lg mb-1">{artist.name}</p>
                <p className="text-sm text-zinc-400 mb-4 whitespace-pre-wrap">{artist.bio || <span className="italic text-zinc-600">No bio set</span>}</p>
                <button
                  onClick={() => setEditingProfile(true)}
                  className="text-xs font-bold text-orange-500 hover:text-orange-400 transition-colors"
                >
                  Edit name & bio
                </button>
              </div>
            )}
          </Section>

          {/* ── Profile Images ────────────────────────────── */}
          <Section title="Profile Images">
            <div className="space-y-8">
              <ImageUploader
                currentUrl={artistAvatarUrl}
                onUpload={handleArtistAvatarUpload}
                onRemove={handleArtistAvatarRemove}
                aspect={1}
                maxSizeMB={2}
                accept="image/jpeg,image/png,image/webp,image/gif"
                label="Artist Avatar"
                variant="avatar"
                accent={artist.accent_colour || '#F56D00'}
                fallback={
                  <div className="w-full h-full rounded-full flex items-center justify-center text-2xl font-black text-zinc-600"
                    style={{ background: `linear-gradient(135deg, ${artist.accent_colour || '#F56D00'}33, ${artist.accent_colour || '#F56D00'}11)` }}>
                    {artist.name.charAt(0)}
                  </div>
                }
              />
              <ImageUploader
                currentUrl={artistBannerUrl}
                onUpload={handleBannerUpload}
                onRemove={handleBannerRemove}
                aspect={3}
                maxSizeMB={5}
                accept="image/jpeg,image/png,image/webp"
                label="Banner"
                recommendedSize="Recommended: 1500×500px (3:1 ratio)"
                variant="banner"
                accent={artist.accent_colour || '#F56D00'}
                fallback={
                  <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs font-bold"
                    style={{ background: `linear-gradient(135deg, ${artist.accent_colour || '#F56D00'}22 0%, #09090b 40%, #09090b 60%, ${artist.accent_colour || '#F56D00'}11 100%)` }}>
                    No banner set
                  </div>
                }
              />
            </div>
          </Section>

          {/* ── Social Accounts ──────────────────────────── */}
          <Section title="Social Accounts">
            <p className="text-zinc-500 text-sm mb-4">Link your social profiles to build trust and help fans find you elsewhere.</p>
            <SocialAccountsEditor initial={artist.social_links || {}} />
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

      {/* Generate download codes modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => !generatingCodes && setShowGenerateModal(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-1">Generate Download Codes</h3>
            <p className="text-zinc-500 text-sm mb-6">Codes let fans download a release for free. Max 200 per release.</p>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 block mb-2">Release</label>
                <select
                  value={generateReleaseId}
                  onChange={e => setGenerateReleaseId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-white focus:border-orange-600 outline-none transition-colors"
                >
                  {rels.map(r => {
                    const c = codesSummary[r.id]
                    const used = c?.total || 0
                    return (
                      <option key={r.id} value={r.id} disabled={used >= 200}>
                        {r.title} ({used}/200 codes)
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 block mb-2">
                  Batch Size: <span className="text-orange-500">{generateBatchSize}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={Math.min(50, 200 - (codesSummary[generateReleaseId]?.total || 0))}
                  value={generateBatchSize}
                  onChange={e => setGenerateBatchSize(parseInt(e.target.value))}
                  className="w-full accent-orange-600"
                />
                <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                  <span>1</span>
                  <span>{Math.min(50, 200 - (codesSummary[generateReleaseId]?.total || 0))}</span>
                </div>
              </div>

              {(() => {
                const c = codesSummary[generateReleaseId]
                const used = c?.total || 0
                const afterGenerate = used + generateBatchSize
                return used > 0 ? (
                  <p className="text-[10px] text-zinc-500">
                    Currently {used} codes · After: {afterGenerate}/200
                  </p>
                ) : null
              })()}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGenerateModal(false)}
                disabled={!!generatingCodes}
                className="flex-1 text-zinc-400 font-bold text-sm py-3 rounded-full border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => generateCodes(generateReleaseId, generateBatchSize)}
                disabled={!!generatingCodes || !generateReleaseId || (codesSummary[generateReleaseId]?.total || 0) >= 200}
                className="flex-1 bg-orange-600 text-black font-bold text-sm py-3 rounded-full hover:bg-orange-500 transition-colors disabled:opacity-50"
              >
                {generatingCodes ? 'Generating...' : `Generate ${generateBatchSize} Codes`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit release modal */}
      {editingRelease && (
        <EditReleaseModal
          release={editingRelease}
          artistId={artist.id}
          onSave={saveRelease}
          onClose={() => setEditingRelease(null)}
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

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/95 border-t border-zinc-900 backdrop-blur-md z-50 flex">
        <MobileNavLink href="/dashboard" label="Home" icon="grid" active />
        <MobileNavLink href="/discography" label="Music" icon="music" />
        <MobileNavLink href="/sales" label="Sales" icon="dollar" />
        <MobileNavLink href="/explore" label="Store" icon="search" />
      </nav>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────

const MOBILE_ICONS: Record<string, JSX.Element> = {
  grid: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
  music: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z" /></svg>,
  dollar: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>,
  search: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>,
}

function MobileNavLink({ href, label, icon, active }: { href: string; label: string; icon: string; active?: boolean }) {
  return (
    <Link href={href} className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${active ? 'text-orange-500' : 'text-zinc-500 hover:text-white'}`}>
      {MOBILE_ICONS[icon] && <span className="[&>svg]:w-5 [&>svg]:h-5">{MOBILE_ICONS[icon]}</span>}
      <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
    </Link>
  )
}

function SidebarLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link href={href} className={`flex items-center gap-3 p-3.5 font-bold rounded-xl text-sm transition-all
      ${active ? 'bg-orange-600/10 text-orange-500' : 'text-zinc-500 hover:bg-orange-600/[0.06] hover:text-white'}`}>
      {label}
    </Link>
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
    refunded: 'text-red-500 bg-red-600/10 border-red-600/20',
    disputed: 'text-orange-500 bg-orange-600/10 border-orange-600/20',
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

function ReleaseRow({ release: r, artistId, artistSlug, onToggle, onCancelPreorder, onEdit, saveCount = 0 }: {
  release: Release; artistId: string; artistSlug: string
  onToggle: (id: string, field: string, value: any) => void
  onCancelPreorder: (id: string) => void
  onEdit: (release: Release) => void
  saveCount?: number
}) {
  const [showControls, setShowControls] = useState(false)
  const [showEmbed, setShowEmbed] = useState(false)
  const [embedCopied, setEmbedCopied] = useState(false)
  const plays = r.tracks.reduce((s, t) => s + t.preview_plays + t.full_plays, 0)
  const coverSrc = r.cover_url || generateGradientDataUri(artistId, r.id)
  const embedCode = `<iframe src="https://getinsound.com/embed/${r.slug}" width="400" height="200" frameborder="0" style="border-radius:12px"></iframe>`

  return (
    <div className="bg-zinc-900/80 border border-zinc-800/60 rounded-xl overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        <img src={coverSrc} alt={r.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{r.title}</p>
          <p className="text-[10px] text-zinc-500">{r.type} · {r.tracks.length} track{r.tracks.length !== 1 ? 's' : ''} · {plays} plays · {saveCount} {saveCount === 1 ? 'save' : 'saves'}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <VisibilityBadge v={r.visibility} />
          {r.published && (
            <button onClick={() => setShowEmbed(!showEmbed)} className="text-[10px] text-zinc-500 hover:text-orange-500 font-bold transition-colors" title="Get embed code">
              Embed
            </button>
          )}
          <button onClick={() => onEdit(r)} className="text-[10px] text-zinc-500 hover:text-orange-500 font-bold transition-colors">Edit</button>
          <a href={`/release?a=${artistSlug}&r=${r.slug}`} className="text-[10px] text-zinc-500 hover:text-orange-500 font-bold transition-colors">View</a>
          <button onClick={() => setShowControls(!showControls)} className="text-zinc-500 hover:text-white transition-colors p-1">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
            </svg>
          </button>
        </div>
      </div>

      {showEmbed && (
        <div className="border-t border-zinc-800/40 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Embed Code</p>
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-[11px] text-zinc-300 break-all leading-relaxed">
            {embedCode}
          </div>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(embedCode)
                setEmbedCopied(true)
                setTimeout(() => setEmbedCopied(false), 2000)
              } catch (err) { console.error('Operation failed:', err) }
            }}
            className="mt-2 bg-orange-600 text-black font-bold text-[10px] px-3 py-1.5 rounded-lg hover:bg-orange-500 transition-colors"
          >
            {embedCopied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
        </div>
      )}

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

function EditReleaseModal({ release, artistId, onSave, onClose }: {
  release: Release; artistId: string
  onSave: (data: { title: string; description: string; genre: string; price_pence: number; coverFile?: File; tracks: { id: string; title: string; position: number }[] }) => Promise<void>
  onClose: () => void
}) {
  const [title, setTitle] = useState(release.title)
  const [description, setDescription] = useState(release.description || '')
  const [genre, setGenre] = useState(release.genre || '')
  const [pricePounds, setPricePounds] = useState((release.price_pence / 100).toFixed(2))
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [tracks, setTracks] = useState(
    [...release.tracks].sort((a, b) => a.position - b.position).map(t => ({ id: t.id, title: t.title, position: t.position }))
  )
  const [saving, setSaving] = useState(false)
  const coverSrc = coverPreview || release.cover_url || generateGradientDataUri(artistId, release.id)

  function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  function moveTrack(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= tracks.length) return
    const next = [...tracks]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setTracks(next.map((t, i) => ({ ...t, position: i + 1 })))
  }

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        description,
        genre,
        price_pence: Math.round(parseFloat(pricePounds || '0') * 100),
        coverFile: coverFile || undefined,
        tracks,
      })
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [saving, onClose])

  const inputClass = 'w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 text-sm text-white focus:border-orange-600 outline-none transition-colors'
  const labelClass = 'text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1'

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg">Edit Release</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Cover art */}
        <div className="mb-6">
          <label className={labelClass}>Cover Art</label>
          <div className="flex items-center gap-4">
            <img src={coverSrc} alt={title} className="w-24 h-24 rounded-lg object-cover shrink-0" />
            <div>
              <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors inline-block">
                Change Cover
                <input type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="mb-4">
          <label className={labelClass}>Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputClass} />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className={labelClass}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={inputClass + ' resize-none'} placeholder="Release notes, credits, liner notes..." />
        </div>

        {/* Genre + Price row */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className={labelClass}>Genre</label>
            <input type="text" value={genre} onChange={e => setGenre(e.target.value)} className={inputClass} placeholder="e.g. Indie, Electronic" />
          </div>
          <div>
            <label className={labelClass}>Price (£)</label>
            <input type="number" value={pricePounds} onChange={e => setPricePounds(e.target.value)} min="0" step="0.01" className={inputClass} />
          </div>
        </div>

        {/* Tracks */}
        {tracks.length > 0 && (
          <div className="mb-6">
            <label className={labelClass}>Tracks</label>
            <div className="space-y-2">
              {tracks.map((t, i) => (
                <div key={t.id} className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-600 font-bold w-5 text-right shrink-0">{t.position}</span>
                  <input
                    type="text"
                    value={t.title}
                    onChange={e => {
                      const next = [...tracks]
                      next[i] = { ...next[i], title: e.target.value }
                      setTracks(next)
                    }}
                    className={inputClass}
                  />
                  {tracks.length > 1 && (
                    <div className="flex flex-col shrink-0">
                      <button onClick={() => moveTrack(i, -1)} disabled={i === 0} className="text-zinc-600 hover:text-white disabled:opacity-20 transition-colors p-0.5">
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6" /></svg>
                      </button>
                      <button onClick={() => moveTrack(i, 1)} disabled={i === tracks.length - 1} className="text-zinc-600 hover:text-white disabled:opacity-20 transition-colors p-0.5">
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose} disabled={saving} className="flex-1 text-zinc-400 font-bold text-sm py-3 rounded-full border border-zinc-800 hover:border-zinc-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !title.trim()} className="flex-1 bg-orange-600 text-black font-bold text-sm py-3 rounded-full hover:bg-orange-500 transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReferralWidget({ referral }: { referral: Referral }) {
  const [copied, setCopied] = useState(false)
  const shareLink = referralShareUrl(referral.code)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) { console.error('Operation failed:', err) }
  }

  return (
    <div className="mb-6 space-y-4">
      <Section title="Share Insound" count={referral.count}>
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Share your link to help more artists discover Insound.
          </p>

          <div className="bg-black/30 rounded-xl p-3 flex items-center gap-3">
            <p className="text-orange-500 font-bold text-xs flex-1 truncate">{shareLink}</p>
            <button
              onClick={copyLink}
              className="shrink-0 bg-orange-600 text-black font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider hover:bg-orange-500 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

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
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

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
      } catch (err) { console.error('Operation failed:', err) }
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
          alt={`${artistName} - First sale on Insound`}
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

function maskId(id: string): string {
  if (id.includes('@')) {
    const [local, domain] = id.split('@')
    const maskedLocal = local.length <= 2 ? local[0] + '***' : local[0] + '***' + local[local.length - 1]
    return `${maskedLocal}@${domain}`
  }
  return id.slice(0, 8) + '...'
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
