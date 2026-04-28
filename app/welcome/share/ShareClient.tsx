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
}

export function ShareClient({ referralCode }: Props) {
  const [copied, setCopied] = useState(false)
  const shareLink = referralShareUrl(referralCode)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-insound-bg">
      <div className="w-full max-w-md">
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
            Share your link to help more artists discover Insound.
          </p>

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
        </div>

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
