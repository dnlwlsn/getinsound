'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  referralShareUrl,
  twitterShareUrl,
  whatsappShareUrl,
  emailShareUrl,
} from '@/lib/referral'

type Props = {
  referralCode: string
  referralCount: number
  zeroFeesUnlocked: boolean
}

export function ShareClient({ referralCode, referralCount, zeroFeesUnlocked }: Props) {
  const [copied, setCopied] = useState(false)
  const shareLink = referralShareUrl(referralCode)
  const filled = Math.min(referralCount, 5)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#09090b' }}>
      <div className="w-full max-w-md">
        {/* Founder's Card */}
        <div
          className="rounded-3xl p-8 relative overflow-hidden"
          style={{
            background: '#141414',
            border: '1px solid rgba(245, 109, 0, 0.3)',
            boxShadow: '0 0 80px rgba(245, 109, 0, 0.08)',
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #F56D00, transparent)' }} />

          <p className="text-orange-600 font-black text-2xl tracking-tighter font-display mb-8">insound.</p>

          <h1 className="font-display text-3xl font-bold tracking-tight mb-3">
            You&apos;re in.
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed mb-8">
            {zeroFeesUnlocked
              ? "You've unlocked 0% Insound fees for your first year. Keep sharing to help more artists get discovered."
              : 'Share your link. Invite 5 friends to unlock 0% Insound fees for your first year.'}
          </p>

          {/* Referral link */}
          <div className="bg-black/40 rounded-xl p-4 mb-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Your referral link</p>
            <div className="flex items-center gap-3">
              <p className="text-orange-500 font-bold text-sm flex-1 truncate font-display">{shareLink}</p>
              <button
                onClick={copyLink}
                className="shrink-0 bg-orange-600 text-black font-bold px-4 py-2 rounded-lg text-xs uppercase tracking-wider hover:bg-orange-500 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Share buttons */}
          <div className="flex gap-3 mb-8">
            <a
              href={twitterShareUrl(referralCode)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/[0.06] rounded-xl py-3 text-center text-xs font-bold text-zinc-300 transition-all"
            >
              𝕏 Twitter
            </a>
            <a
              href={whatsappShareUrl(referralCode)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/[0.06] rounded-xl py-3 text-center text-xs font-bold text-zinc-300 transition-all"
            >
              WhatsApp
            </a>
            <a
              href={emailShareUrl(referralCode)}
              className="flex-1 bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/[0.06] rounded-xl py-3 text-center text-xs font-bold text-zinc-300 transition-all"
            >
              Email
            </a>
          </div>

          {/* Progress indicator */}
          <div className="text-center">
            <div className="flex justify-center gap-3 mb-3">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center"
                  style={{
                    borderColor: i < filled ? '#F56D00' : 'rgba(255,255,255,0.08)',
                    background: i < filled ? 'rgba(245, 109, 0, 0.15)' : 'transparent',
                  }}
                >
                  {i < filled && (
                    <svg width="14" height="14" fill="none" stroke="#F56D00" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
            <p className="text-zinc-500 text-xs font-bold">
              {zeroFeesUnlocked
                ? 'Zero fees unlocked!'
                : `${filled} of 5 friends invited`}
            </p>
          </div>
        </div>

        {/* Continue link */}
        <div className="text-center mt-8">
          <Link
            href="/explore"
            className="text-zinc-500 hover:text-white text-sm font-bold transition-colors"
          >
            Continue to Insound →
          </Link>
        </div>
      </div>
    </div>
  )
}
