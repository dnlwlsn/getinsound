'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'

interface ShelfProps {
  title: string
  subtitle?: string
  seeAllHref?: string
  children: React.ReactNode
  pulse?: boolean
}

export function Shelf({ title, subtitle, seeAllHref, children, pulse }: ShelfProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function check() {
      if (!el) return
      setCanScrollLeft(el.scrollLeft > 4)
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
    }
    check()
    el.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', check); ro.disconnect() }
  }, [])

  function scroll(dir: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.75
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  return (
    <section className="py-6">
      <div className="flex items-center justify-between mb-4 px-5 md:px-10 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          {pulse && <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />}
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">{title}</h2>
          {subtitle && <span className="text-[10px] text-zinc-600 font-bold hidden sm:block">{subtitle}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            className={`w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center transition-opacity hidden sm:flex ${canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            aria-label="Scroll left"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button
            onClick={() => scroll('right')}
            className={`w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center transition-opacity hidden sm:flex ${canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            aria-label="Scroll right"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          {seeAllHref && (
            <Link href={seeAllHref} className="text-[10px] font-black text-zinc-600 hover:text-orange-500 uppercase tracking-widest transition-colors ml-1">
              See all
            </Link>
          )}
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto px-5 md:px-10 pb-2 shelf-scroll snap-x snap-mandatory"
        style={{ scrollPaddingLeft: '1.25rem' }}
      >
        {children}
      </div>
    </section>
  )
}

interface ShelfCardProps {
  href: string
  coverUrl: string
  title: string
  subtitle: string
  badge?: string
  price?: string
  className?: string
}

export function ShelfCard({ href, coverUrl, title, subtitle, badge, price, className = '' }: ShelfCardProps) {
  return (
    <Link href={href} className={`flex-shrink-0 snap-start group w-[160px] sm:w-[180px] ${className}`}>
      <div className="aspect-square rounded-2xl overflow-hidden mb-3 ring-1 ring-white/[0.06] relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverUrl}
          alt={`${title} by ${subtitle}`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {badge && (
          <span className="absolute top-2 left-2 bg-orange-600 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
            {badge}
          </span>
        )}
      </div>
      <p className="font-display font-bold text-sm text-white truncate">{title}</p>
      <p className="text-xs text-zinc-500 truncate mt-0.5">{subtitle}</p>
      {price && (
        <span className="inline-block mt-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-orange-600/[0.08] ring-1 ring-orange-600/[0.15] text-orange-400 rounded-full">
          {price}
        </span>
      )}
    </Link>
  )
}
