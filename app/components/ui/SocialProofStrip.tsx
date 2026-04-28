'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

export interface ActivityItem {
  type: 'purchase' | 'follow'
  created_at: string
  release_title?: string
  release_slug?: string
  cover_url?: string
  artist_name: string
  artist_slug: string
}

export function SocialProofStrip({ items }: { items: ActivityItem[] }) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  const advance = useCallback(() => {
    setVisible(false)
    setTimeout(() => {
      setIndex(i => (i + 1) % items.length)
      setVisible(true)
    }, 300)
  }, [items.length])

  useEffect(() => {
    if (items.length <= 1) return

    const id = setInterval(() => {
      if (document.hidden) return
      advance()
    }, 4000)

    return () => clearInterval(id)
  }, [items.length, advance])

  if (items.length === 0) return null

  const item = items[index]

  return (
    <section className="border-b border-zinc-900">
      <div className="max-w-7xl mx-auto px-5 md:px-10 py-4 flex items-center justify-center gap-3 min-h-[52px]">
        <div
          className={`flex items-center gap-3 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        >
          {item.type === 'purchase' && item.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.cover_url}
              alt=""
              className="w-8 h-8 rounded object-cover ring-1 ring-white/[0.06]"
            />
          )}
          <p className="text-sm text-zinc-400">
            {item.type === 'purchase' ? (
              <>
                Someone just bought{' '}
                <Link
                  href={`/release?a=${item.artist_slug}&r=${item.release_slug}`}
                  className="font-bold text-white hover:text-orange-400 transition-colors"
                >
                  {item.release_title}
                </Link>
                {' '}by{' '}
                <Link
                  href={`/${item.artist_slug}`}
                  className="text-zinc-300 hover:text-orange-400 transition-colors"
                >
                  {item.artist_name}
                </Link>
              </>
            ) : (
              <>
                Someone just followed{' '}
                <Link
                  href={`/${item.artist_slug}`}
                  className="font-bold text-white hover:text-orange-400 transition-colors"
                >
                  {item.artist_name}
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </section>
  )
}
