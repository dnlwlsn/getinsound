'use client'

import { useState } from 'react'

interface ImpactData {
  releaseCount: number
  totalSales: number
  activePreorders: number
}

interface Props {
  userType: 'fan' | 'artist'
  impactData?: ImpactData
  onConfirm: () => Promise<void>
  onCancel: () => void
  onDownload: () => void
  downloading: boolean
}

export function DeleteAccountModal({ userType, impactData, onConfirm, onCancel, onDownload, downloading }: Props) {
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isValid = confirmText === 'DELETE'

  async function handleConfirm() {
    if (!isValid) return
    setSubmitting(true)
    setError('')
    try {
      await onConfirm()
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
      onClick={() => !submitting && onCancel()}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-sm shrink-0">⚠</div>
          <h3 className="font-display text-lg font-bold">Delete your account?</h3>
        </div>

        {/* Artist impact stats */}
        {userType === 'artist' && impactData && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Impact Summary</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-bold">{impactData.releaseCount}</p>
                <p className="text-[10px] text-zinc-500">Releases</p>
              </div>
              <div>
                <p className="text-xl font-bold">{impactData.totalSales}</p>
                <p className="text-[10px] text-zinc-500">Total sales</p>
              </div>
              <div>
                <p className={`text-xl font-bold ${impactData.activePreorders > 0 ? 'text-orange-500' : ''}`}>
                  {impactData.activePreorders}
                </p>
                <p className={`text-[10px] ${impactData.activePreorders > 0 ? 'text-orange-500' : 'text-zinc-500'}`}>
                  Active pre-orders
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Warning text */}
        {userType === 'artist' ? (
          <div className="mb-4">
            <p className="text-xs font-bold text-zinc-300 mb-2">Deleting your account will:</p>
            <ul className="text-xs text-zinc-500 space-y-1.5 list-disc pl-4">
              <li>Remove all your releases from the platform</li>
              <li>Give existing purchasers <strong className="text-white">90 days</strong> to download their files</li>
              {impactData && impactData.activePreorders > 0 && (
                <li className="text-orange-500">
                  Cancel {impactData.activePreorders} active pre-order{impactData.activePreorders !== 1 ? 's' : ''} — fans will be refunded
                </li>
              )}
              <li>Remove your artist profile permanently</li>
              <li>Remove your fan account and library</li>
            </ul>
          </div>
        ) : (
          <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
            This will permanently delete your account, your library, your profile, and all associated data.
            Your purchased music will no longer be accessible through Insound.
            We recommend downloading your purchases before proceeding.{' '}
            <strong className="text-white">This cannot be undone.</strong>
          </p>
        )}

        {/* Stripe note for artists */}
        {userType === 'artist' && (
          <div className="bg-green-950/30 border border-green-900/40 rounded-lg p-3 mb-4">
            <p className="text-xs text-zinc-400">
              <strong className="text-green-400">Stripe:</strong> Your connected account will remain active until all pending payouts have settled, then it will be disconnected.
            </p>
          </div>
        )}

        {/* Download button */}
        <button
          onClick={onDownload}
          disabled={downloading}
          className="w-full bg-transparent border border-zinc-700 text-white py-3 rounded-xl text-sm font-bold mb-4 hover:border-zinc-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {downloading ? 'Generating links...' : '↓ Download all my music'}
        </button>

        {/* Type DELETE */}
        <div className="mb-4">
          <label className="text-xs text-zinc-500 block mb-2">
            Type <span className="text-red-400 font-bold">DELETE</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="DELETE"
            disabled={submitting}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-white placeholder-zinc-700 outline-none focus:border-red-600 transition-colors disabled:opacity-50"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 text-zinc-400 font-bold text-sm py-3 rounded-full border border-zinc-800 hover:border-zinc-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || !isValid}
            className="flex-1 bg-red-600 text-white font-bold text-sm py-3 rounded-full hover:bg-red-500 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Scheduling...' : 'Delete my account permanently'}
          </button>
        </div>

        <p className="text-[10px] text-zinc-600 text-center mt-4">
          Your account will be scheduled for deletion in 24 hours. You can cancel anytime before then.
        </p>
      </div>
    </div>
  )
}
