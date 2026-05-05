'use client'

import { useState, useEffect } from 'react'
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed } from '@/lib/pwa/push'
import { supportsWebPush, isIOS } from '@/lib/pwa/ios'

type PrefType = {
  type: string
  label: string
  in_app: boolean
  email: boolean
}

const FAN_TYPES: { type: string; label: string }[] = [
  { type: 'preorder_ready', label: 'Pre-order ready for download' },
  { type: 'order_dispatched', label: 'Order dispatched' },
]

const ARTIST_TYPES: { type: string; label: string }[] = [
  { type: 'sale', label: 'New sale' },
  { type: 'preorder', label: 'New pre-order' },
  { type: 'merch_order', label: 'New merch order' },
]

interface Props {
  isArtist: boolean
}

export function NotificationPreferences({ isArtist }: Props) {
  const types = isArtist ? [...ARTIST_TYPES, ...FAN_TYPES] : FAN_TYPES
  const [prefs, setPrefs] = useState<PrefType[]>(
    types.map(t => ({ ...t, in_app: true, email: true }))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  useEffect(() => {
    fetch('/api/notifications/preferences')
      .then(r => r.json())
      .then(data => {
        if (!data.preferences) return
        setPrefs(prev => prev.map(p => {
          const match = data.preferences.find((sp: any) => sp.type === p.type)
          return match ? { ...p, in_app: match.in_app, email: match.email } : p
        }))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const supported = supportsWebPush()
    setPushSupported(supported)
    if (supported) {
      isPushSubscribed().then(setPushEnabled)
    }
  }, [])

  async function togglePush() {
    setPushLoading(true)
    if (pushEnabled) {
      const ok = await unsubscribeFromPush()
      if (ok) setPushEnabled(false)
    } else {
      const ok = await subscribeToPush()
      if (ok) setPushEnabled(true)
    }
    setPushLoading(false)
  }

  function toggle(type: string, field: 'in_app' | 'email') {
    setPrefs(prev => prev.map(p =>
      p.type === type ? { ...p, [field]: !p[field] } : p
    ))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    await fetch('/api/notifications/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferences: prefs.map(p => ({ type: p.type, in_app: p.in_app, email: p.email })),
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-4">
        Notification Preferences
      </label>

      {/* Push notifications toggle */}
      {pushSupported ? (
        <div className="mb-6 p-4 rounded-xl bg-zinc-900/50 border border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Push Notifications</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Get notified instantly when something happens
              </p>
            </div>
            <button
              onClick={togglePush}
              disabled={pushLoading}
              className={`w-9 h-5 rounded-full transition-colors relative ${
                pushEnabled ? 'bg-orange-600' : 'bg-zinc-700'
              } ${pushLoading ? 'opacity-50' : ''}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                pushEnabled ? 'left-[18px]' : 'left-0.5'
              }`} />
            </button>
          </div>
        </div>
      ) : isIOS() ? (
        <div className="mb-6 p-4 rounded-xl bg-zinc-900/50 border border-white/[0.06]">
          <p className="text-sm font-semibold text-white">Notifications</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            Push notifications aren&apos;t available on iOS. We&apos;ll send notifications via email instead.
          </p>
        </div>
      ) : null}

      {/* Column headers */}
      <div className="flex items-center gap-2 mb-3 pl-0">
        <div className="flex-1" />
        <span className="w-16 text-center text-[10px] font-bold text-zinc-600 uppercase">In-App</span>
        <span className="w-16 text-center text-[10px] font-bold text-zinc-600 uppercase">Email</span>
      </div>

      <div className="space-y-1">
        {isArtist && (
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 pt-2 pb-1">Artist</p>
        )}
        {prefs.map((p, i) => (
          <div key={p.type}>
            {isArtist && i === ARTIST_TYPES.length && (
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 pt-4 pb-1">Fan</p>
            )}
            <div className="flex items-center gap-2 py-2">
              <p className="flex-1 text-sm text-zinc-300">{p.label}</p>
              <div className="w-16 flex justify-center">
                <button
                  onClick={() => toggle(p.type, 'in_app')}
                  className={`w-9 h-5 rounded-full transition-colors relative ${
                    p.in_app ? 'bg-orange-600' : 'bg-zinc-700'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    p.in_app ? 'left-[18px]' : 'left-0.5'
                  }`} />
                </button>
              </div>
              <div className="w-16 flex justify-center">
                <button
                  onClick={() => toggle(p.type, 'email')}
                  className={`w-9 h-5 rounded-full transition-colors relative ${
                    p.email ? 'bg-orange-600' : 'bg-zinc-700'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    p.email ? 'left-[18px]' : 'left-0.5'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-6 px-6 py-2.5 bg-orange-600 text-white text-sm font-bold rounded-xl hover:bg-orange-500 transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save preferences'}
      </button>
    </div>
  )
}
