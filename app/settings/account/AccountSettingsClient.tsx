'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { resolveAccent, DEFAULT_ACCENT } from '@/lib/accent'
import { SettingsTabs } from '@/components/settings/SettingsTabs'
import { DeleteAccountModal } from '@/components/settings/DeleteAccountModal'
import { DeletionPendingBanner } from '@/components/settings/DeletionPendingBanner'
import { NotificationPreferences } from '@/components/settings/NotificationPreferences'
import { NotificationBell } from '@/app/components/ui/NotificationBell'

interface Props {
  userEmail: string
  userId: string
  pendingDeletion: { id: string; execute_at: string } | null
}

export function AccountSettingsClient({ userEmail, userId, pendingDeletion }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showModal, setShowModal] = useState(false)
  const [pending, setPending] = useState(pendingDeletion)
  const [downloading, setDownloading] = useState(false)
  const resolvedAccent = resolveAccent(DEFAULT_ACCENT)

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
    router.replace('/settings/account')
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
    } catch (e) {
      console.error('Download failed:', e)
    }
    setDownloading(false)
  }

  return (
    <div className="min-h-screen flex flex-col relative"
      style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)', backgroundSize: '48px 48px' }}>

      <nav className="sticky top-0 w-full z-50 flex justify-between items-center px-6 md:px-14 py-5 border-b border-zinc-900/80"
        style={{ background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <Link href="/" className="text-2xl font-black tracking-tighter hover:text-orange-500 transition-colors font-display"
          style={{ color: resolvedAccent }}>
          insound.
        </Link>
        <div className="flex gap-4 items-center">
          <Link href="/library"
            className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
            Library
          </Link>
          <NotificationBell userId={userId} />
        </div>
      </nav>

      <div className="flex-1 flex items-start justify-center p-6 pt-12 relative">
        <div className="w-full max-w-lg relative z-10">
          <h1 className="font-display text-2xl font-bold mb-2">Settings</h1>
          <p className="text-zinc-500 text-sm mb-6">Manage your account.</p>

          <SettingsTabs />

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

            <NotificationPreferences isArtist={false} />

            {!pending && (
              <div className="border border-red-900/30 bg-red-950/10 rounded-xl p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-4">Danger Zone</p>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold mb-1">Delete account</p>
                    <p className="text-xs text-zinc-500">Permanently delete your account and all associated data.</p>
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
          userType="fan"
          onConfirm={handleConfirm}
          onCancel={() => setShowModal(false)}
          onDownload={handleDownload}
          downloading={downloading}
        />
      )}
    </div>
  )
}
