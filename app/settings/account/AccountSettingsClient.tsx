'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SettingsTabs } from '@/components/settings/SettingsTabs'
import { DeleteAccountModal } from '@/components/settings/DeleteAccountModal'
import { DeletionPendingBanner } from '@/components/settings/DeletionPendingBanner'
import { NotificationPreferences } from '@/components/settings/NotificationPreferences'
import { ReverifyModal } from '@/components/settings/ReverifyModal'

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
  const [newEmail, setNewEmail] = useState('')
  const [emailChanging, setEmailChanging] = useState(false)
  const [emailChangeSuccess, setEmailChangeSuccess] = useState(false)
  const [emailChangeError, setEmailChangeError] = useState('')
  const [showReverify, setShowReverify] = useState(false)
  const [pendingAction, setPendingAction] = useState<'email' | 'delete' | null>(null)

  useEffect(() => {
    if (searchParams.get('cancel-deletion') === 'true' && pending) {
      handleCancel()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleEmailChange() {
    setEmailChanging(true)
    setEmailChangeError('')

    const res = await fetch('/api/account/change-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newEmail }),
    })

    if (res.status === 403) {
      const data = await res.json()
      if (data.code === 'FRESH_AUTH_REQUIRED') {
        setPendingAction('email')
        setShowReverify(true)
        setEmailChanging(false)
        return
      }
    }

    if (!res.ok) {
      const data = await res.json()
      setEmailChangeError(data.error || 'Failed to change email')
      setEmailChanging(false)
      return
    }

    setEmailChangeSuccess(true)
    setNewEmail('')
    setEmailChanging(false)
  }

  async function handleConfirm() {
    const res = await fetch('/api/account/delete', { method: 'POST' })

    if (res.status === 403) {
      const data = await res.json()
      if (data.code === 'FRESH_AUTH_REQUIRED') {
        setPendingAction('delete')
        setShowReverify(true)
        return
      }
    }

    if (res.ok) {
      window.location.reload()
    }
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

            {/* Change email */}
            <div className="mt-8 pt-8 border-t border-zinc-800">
              <h2 className="text-lg font-semibold mb-4">Change email</h2>
              {emailChangeSuccess ? (
                <p className="text-sm text-green-400">
                  Email updated. A notification was sent to your previous email.
                </p>
              ) : (
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-sm text-zinc-400 block mb-1">New email address</label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      placeholder="new@example.com"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <button
                    onClick={handleEmailChange}
                    disabled={emailChanging || !newEmail}
                    className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {emailChanging ? 'Updating...' : 'Update email'}
                  </button>
                </div>
              )}
              {emailChangeError && (
                <p className="text-sm text-red-400 mt-2">{emailChangeError}</p>
              )}
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

      {showReverify && (
        <ReverifyModal
          email={userEmail}
          onVerified={() => {
            setShowReverify(false)
            if (pendingAction === 'email') handleEmailChange()
            if (pendingAction === 'delete') handleConfirm()
            setPendingAction(null)
          }}
          onClose={() => {
            setShowReverify(false)
            setPendingAction(null)
          }}
        />
      )}
    </div>
  )
}
