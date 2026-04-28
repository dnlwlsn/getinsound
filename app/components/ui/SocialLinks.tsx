'use client'

import { useState } from 'react'
import { type SocialPlatform, type SocialLinks as SocialLinksType, getSocialIcon } from '@/lib/verification'

interface Props {
  links: SocialLinksType
}

export function SocialLinksRow({ links }: Props) {
  if (!links || Object.keys(links).length === 0) return null

  const entries = Object.entries(links) as [SocialPlatform, { url: string; verified: boolean; verified_at: string | null }][]
  const valid = entries.filter(([, v]) => v?.url)

  if (valid.length === 0) return null

  return (
    <div className="flex items-center gap-2 mt-3">
      {valid.map(([platform, link]) => (
        <SocialIcon key={platform} platform={platform} url={link.url} verified={link.verified} />
      ))}
    </div>
  )
}

function SocialIcon({ platform, url, verified }: { platform: SocialPlatform; url: string; verified: boolean }) {
  const [show, setShow] = useState(false)
  const label = { instagram: 'Instagram', twitter: 'X / Twitter', spotify: 'Spotify', soundcloud: 'SoundCloud', youtube: 'YouTube', website: 'Website' }[platform]

  return (
    <span className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.04] ring-1 ring-white/[0.08] hover:ring-white/[0.16] hover:bg-white/[0.08] transition-all"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className={verified ? 'text-zinc-400' : 'text-zinc-600'}>
          <path d={getSocialIcon(platform)} />
        </svg>
        {verified && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-600 border-2 border-insound-bg flex items-center justify-center">
            <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
      </a>

      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-200 font-medium whitespace-nowrap z-50 shadow-xl pointer-events-none">
          {verified ? `Verified on ${label}` : label}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-zinc-800" />
        </span>
      )}
    </span>
  )
}
