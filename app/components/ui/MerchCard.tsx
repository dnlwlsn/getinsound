'use client'

import Link from 'next/link'
import Image from 'next/image'

interface MerchCardProps {
  id: string
  name: string
  price: string
  photo: string | null
  artistSlug: string
  soldOut: boolean
  accent: string
}

export function MerchCard({ id, name, price, photo, artistSlug, soldOut, accent }: MerchCardProps) {
  return (
    <Link href={`/${artistSlug}/merch/${id}`} className="group">
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 mb-2.5 transition-transform group-hover:scale-[1.02]">
        {photo ? (
          <Image src={photo} fill className="object-cover" sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" alt={name} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-700">
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}
        {soldOut && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-xs font-black uppercase tracking-widest text-white bg-black/80 px-3 py-1.5 rounded-full">Sold out</span>
          </div>
        )}
      </div>
      <p className="font-bold text-sm text-white truncate group-hover:opacity-80 transition-opacity">{name}</p>
      <p className="text-xs mt-0.5 font-semibold" style={{ color: accent }}>{price}</p>
    </Link>
  )
}
