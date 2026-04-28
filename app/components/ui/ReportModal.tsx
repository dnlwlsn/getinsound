'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = [
  { value: 'dmca_copyright', label: 'DMCA / Copyright infringement' },
  { value: 'ai_generated_music', label: 'AI-generated music' },
  { value: 'impersonation', label: 'Impersonation / Fake profile' },
  { value: 'harassment_hate_speech', label: 'Harassment or hate speech' },
  { value: 'spam_scam', label: 'Spam or scam' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'underage_user', label: 'Underage user' },
  { value: 'stolen_artwork', label: 'Stolen artwork / imagery' },
  { value: 'misleading_info', label: 'Misleading information' },
  { value: 'other', label: 'Other' },
] as const

interface Props {
  profileType: 'artist' | 'fan'
  artistId?: string
  fanId?: string
  profileName: string
  onClose: () => void
}

export function ReportModal({ profileType, artistId, fanId, profileName, onClose }: Props) {
  const [category, setCategory] = useState<string | null>(null)
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<'success' | 'duplicate' | 'limit' | 'auth' | 'error' | null>(null)

  async function submit() {
    if (!category) return
    setSubmitting(true)
    setResult(null)

    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileType,
        artistId: profileType === 'artist' ? artistId : undefined,
        fanId: profileType === 'fan' ? fanId : undefined,
        category,
        details: details.trim() || undefined,
      }),
    })

    if (res.ok) {
      setResult('success')
    } else if (res.status === 409) {
      setResult('duplicate')
    } else if (res.status === 429) {
      setResult('limit')
    } else if (res.status === 401) {
      setResult('auth')
    } else {
      setResult('error')
    }
    setSubmitting(false)
  }

  const resultMessages = {
    success: 'Report submitted. We\'ll review it shortly.',
    duplicate: 'You\'ve already reported this profile for this reason.',
    limit: 'You\'ve reached the daily report limit. Try again later.',
    auth: 'You need to be signed in to report a profile.',
    error: 'We couldn\'t submit your report. Check your connection and try again.',
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Report {profileName}</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors" aria-label="Close">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-zinc-500 text-xs mt-1">Your report is confidential. The reported user will not see who reported them.</p>
        </div>

        {result ? (
          <div className="px-6 py-8 text-center">
            <div className={`w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${result === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              {result === 'success' ? (
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-green-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-red-400">
                  <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
                </svg>
              )}
            </div>
            <p className="text-sm text-zinc-300 font-medium">{resultMessages[result]}</p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-bold transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Why are you reporting this profile?</p>
              <div className="space-y-1.5">
                {CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      category === c.value
                        ? 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30'
                        : 'bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {category && (
                <div className="mt-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2 block">
                    Additional details (optional)
                  </label>
                  <textarea
                    value={details}
                    onChange={e => setDetails(e.target.value)}
                    placeholder="Provide any additional context..."
                    maxLength={1000}
                    rows={3}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-orange-600 resize-none"
                  />
                  <p className="text-zinc-600 text-xs mt-1 text-right">{details.length}/1000</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-bold text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!category || submitting}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
