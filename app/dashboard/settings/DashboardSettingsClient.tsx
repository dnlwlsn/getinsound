'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DeleteAccountModal } from '@/components/settings/DeleteAccountModal'
import { DeletionPendingBanner } from '@/components/settings/DeletionPendingBanner'
import { NotificationPreferences } from '@/components/settings/NotificationPreferences'

interface Props {
  userEmail: string
  userId: string
  artistName: string
  stripeConnected: boolean
  stripeAccountId: string | null
  pendingDeletion: { id: string; execute_at: string } | null
  impact: { releaseCount: number; totalSales: number; activePreorders: number }
}

export function DashboardSettingsClient({
  userEmail, userId, artistName, stripeConnected, stripeAccountId,
  pendingDeletion, impact,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showModal, setShowModal] = useState(false)
  const [pending, setPending] = useState(pendingDeletion)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (searchParams.get('cancel-deletion') === 'true' && pending) {
      handleCancel()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConfirm() {
    const res = await fetch('/api/account/delete', { method: 'POST' })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to schedule deletion')
    }
    const data = await res.json()
    setPending({ id: data.id, execute_at: data.execute_at })
    setShowModal(false)
  }

  async function handleCancel() {
    const res = await fetch('/api/account/delete', { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to cancel deletion')
    }
    setPending(null)
    router.replace('/dashboard/settings')
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch('/api/account/delete/download-links')
      const data = await res.json()
      if (data.releases?.length > 0) {
        for (const r of data.releases) {
          window.open(`/download/${r.downloadToken}`, '_blank')
        }
      }
    } catch {
      // error handled by UI state
    }
    setDownloading(false)
  }

  return (
    <div className="min-h-screen flex flex-col relative"
      style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)', backgroundSize: '48px 48px' }}>

      <div className="flex-1 flex items-start justify-center p-6 pt-12 relative">
        <div className="w-full max-w-lg relative z-10">
          <h1 className="font-display text-2xl font-bold mb-2">Account Settings</h1>
          <p className="text-zinc-500 text-sm mb-8">{artistName}</p>

          {pending && (
            <DeletionPendingBanner
              executeAt={pending.execute_at}
              onCancel={handleCancel}
            />
          )}

          <div className="space-y-8">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Email</label>
              <p className="text-sm text-zinc-300">{userEmail}</p>
            </div>

            <NotificationPreferences isArtist={true} />

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Stripe Connect</label>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${stripeConnected ? 'bg-green-500' : 'bg-zinc-600'}`} />
                <p className="text-sm text-zinc-300">
                  {stripeConnected ? `Connected — ${stripeAccountId}` : 'Not connected'}
                </p>
              </div>
            </div>

            {!pending && (
              <div className="border border-red-900/30 bg-red-950/10 rounded-xl p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-4">Danger Zone</p>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold mb-1">Delete account</p>
                    <p className="text-xs text-zinc-500">Permanently delete your artist profile, releases, and fan account.</p>
                  </div>
                  <button
                    onClick={() => setShowModal(true)}
                    className="shrink-0 text-xs font-bold px-4 py-2 rounded-lg border border-red-600/40 text-red-400 bg-red-600/10 hover:bg-red-600/20 transition-colors"
                  >
                    Delete my account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <DeleteAccountModal
          userType="artist"
          impactData={impact}
          onConfirm={handleConfirm}
          onCancel={() => setShowModal(false)}
          onDownload={handleDownload}
          downloading={downloading}
        />
      )}
    </div>
  )
}
