'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCurrency } from '@/app/providers/CurrencyProvider'
import type { FanPurchase, FanBadge } from './types'

const BADGE_META: Record<string, { label: string; icon: string }> = {
  founding_fan: { label: 'Founding Fan', icon: '⭐' },
  limited_edition: { label: 'Limited Edition', icon: '💎' },
  early_supporter: { label: 'Early Supporter', icon: '🎵' },
}

function badgeLabel(type: string): string {
  return BADGE_META[type]?.label ?? type
}

function badgeIcon(type: string): string {
  return BADGE_META[type]?.icon ?? '🏷'
}

export function VinylCard({ purchase, accent, showAmount, editing, isPinned, onTogglePin, badges }: {
  purchase: FanPurchase
  accent: string
  showAmount: boolean
  editing: boolean
  isPinned: boolean
  onTogglePin: (releaseId: string) => void
  badges: FanBadge[]
}) {
  const { formatPrice } = useCurrency()
  const isAlbum = purchase.releases.type === 'album'

  function handleTilt(e: React.MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    e.currentTarget.style.transform = `perspective(600px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) scale(1.02)`
  }

  function resetTilt(e: React.MouseEvent<HTMLElement>) {
    e.currentTarget.style.transform = ''
  }

  return (
    <div
      className={`group relative bg-white/[0.02] ring-1 ring-white/[0.06] rounded-2xl overflow-hidden transition-transform duration-300 ease-out ${isAlbum ? 'col-span-2 row-span-2' : ''}`}
      onMouseMove={handleTilt}
      onMouseLeave={resetTilt}
    >
      <Link href={`/${purchase.artists.slug}`}>
        <div className="aspect-square relative">
          {purchase.releases.cover_url ? (
            <Image src={purchase.releases.cover_url} alt={purchase.releases.title} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900">
              <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-zinc-700">
                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          )}
          {badges.length > 0 && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-3">
              <div className="flex flex-wrap gap-1">
                {badges.map(b => (
                  <span key={b.badge_type}
                    className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{ background: `${accent}30`, color: accent }}>
                    {badgeIcon(b.badge_type)} {badgeLabel(b.badge_type)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="p-4">
          <p className="font-display font-bold text-sm truncate group-hover:text-white transition-colors">{purchase.releases.title}</p>
          <p className="text-xs text-zinc-500 mt-1 truncate">{purchase.artists.name}</p>
          {showAmount && (
            <p className="text-[10px] text-zinc-600 mt-2">{formatPrice(purchase.amount_pence / 100, purchase.fan_currency || 'GBP')}</p>
          )}
        </div>
      </Link>

      {isPinned && !editing && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-[10px]"
          style={{ background: accent, color: '#000' }}>
          &#9733;
        </div>
      )}

      {editing && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin(purchase.releases.id) }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm backdrop-blur-sm"
          style={isPinned
            ? { background: accent, color: '#000' }
            : { background: 'rgba(0,0,0,0.6)', color: '#fff' }
          }
        >
          {isPinned ? '★' : '☆'}
        </button>
      )}
    </div>
  )
}
