'use client'

import { type ReactNode } from 'react'

type NavLink = {
  label: string
  href: string
}

type Props = {
  logo?: ReactNode
  links?: NavLink[]
  cta?: ReactNode
  className?: string
}

export function NavBar({ logo, links = [], cta, className = '' }: Props) {
  return (
    <nav className={`fixed top-0 inset-x-0 z-50 ${className}`}>
      <div
        id="navInner"
        className="mx-auto max-w-6xl mt-4 rounded-full px-6 py-3
          flex items-center justify-between
          ring-1 ring-white/[0.06]"
      >
        {/* Logo */}
        <div className="shrink-0">
          {logo ?? (
            <span className="font-display text-lg font-bold text-white
">
              insound
            </span>
          )}
        </div>

        {/* Centre links — hidden on mobile */}
        {links.length > 0 && (
          <div className="hidden md:flex items-center gap-6">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors
"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="shrink-0">{cta}</div>
      </div>
    </nav>
  )
}
