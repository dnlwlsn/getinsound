'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'

interface MenuItem {
  label: string
  icon?: React.ReactNode
  href?: string
  onClick?: () => void
  divider?: boolean
}

interface ContextMenuProps {
  items: MenuItem[]
  children: React.ReactNode
  className?: string
}

export function ContextMenu({ items, children, className }: ContextMenuProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setPos(null), [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const vw = window.innerWidth, vh = window.innerHeight
    let x = e.clientX, y = e.clientY
    if (x + 200 > vw) x = vw - 210
    if (y + items.length * 40 > vh) y = vh - items.length * 40 - 10
    setPos({ x, y })
  }, [items.length])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    longPressRef.current = setTimeout(() => {
      setPos({ x: touch.clientX, y: touch.clientY - 40 })
    }, 500)
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (longPressRef.current) clearTimeout(longPressRef.current)
  }, [])

  useEffect(() => {
    if (!pos) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close()
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('click', handleClick)
    window.addEventListener('keydown', handleEsc)
    return () => { window.removeEventListener('click', handleClick); window.removeEventListener('keydown', handleEsc) }
  }, [pos, close])

  return (
    <>
      <div
        ref={wrapRef}
        className={className}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
      >
        {children}
      </div>
      {pos && (
        <div
          ref={menuRef}
          className="fixed z-[60] min-w-[180px] bg-zinc-900 border border-white/[0.08] rounded-xl shadow-2xl py-1.5 animate-context-menu"
          style={{ left: pos.x, top: pos.y }}
        >
          {items.map((item, i) => {
            if (item.divider) return <div key={i} className="my-1 h-px bg-white/[0.06]" />
            const cls = "flex items-center gap-2.5 px-3.5 py-2 text-sm text-zinc-300 hover:bg-white/[0.05] hover:text-white transition-colors w-full text-left"
            if (item.href) {
              return (
                <Link key={i} href={item.href} className={cls} onClick={close}>
                  {item.icon}<span>{item.label}</span>
                </Link>
              )
            }
            return (
              <button key={i} className={cls} onClick={() => { item.onClick?.(); close() }}>
                {item.icon}<span>{item.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
