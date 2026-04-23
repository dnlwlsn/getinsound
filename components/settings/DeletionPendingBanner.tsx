'use client'

import { useState } from 'react'

interface Props {
  executeAt: string
  onCancel: () => Promise<void>
}

export function DeletionPendingBanner({ executeAt, onCancel }: Props) {
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')

  const date = new Date(executeAt)
  const formatted = date.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  async function handleCancel() {
    setCancelling(true)
    setError('')
    try {
      await onCancel()
    } catch (e) {
      setError((e as Error).message)
      setCancelling(false)
    }
  }

  return (
    <div className="border border-orange-500 bg-orange-950/20 rounded-xl p-5 mb-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-orange-500 mb-1">Account deletion scheduled</p>
          <p className="text-xs text-zinc-400">
            Your account will be permanently deleted on <strong className="text-white">{formatted}</strong>
          </p>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </div>
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="shrink-0 text-xs font-bold px-4 py-2 rounded-lg border border-orange-500 text-orange-500 hover:bg-orange-500/10 transition-colors disabled:opacity-50"
        >
          {cancelling ? 'Cancelling...' : 'Cancel deletion'}
        </button>
      </div>
      <p className="text-[10px] text-zinc-600 mt-3">
        A confirmation email has been sent. You'll receive a final reminder 1 hour before deletion.
      </p>
    </div>
  )
}
