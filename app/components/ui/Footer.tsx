'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { InsoundLogo } from '@/app/components/ui/InsoundLogo'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/for-artists', label: 'Artists' },
  { href: '/for-fans', label: 'Fans' },
  { href: '/for-press', label: 'Press' },
  { href: '/faq', label: 'FAQ' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/ai-policy', label: 'AI Policy' },
]

export function Footer() {
  const pathname = usePathname()

  return (
    <footer className="border-t border-zinc-900/80 py-16">
      <div className="max-w-4xl mx-auto px-6 flex flex-col items-center gap-6">
        <InsoundLogo size="sm" />
        <div className="flex flex-wrap justify-center gap-6 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          {LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname === l.href ? 'text-orange-500' : 'hover:text-orange-500 transition-colors'}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <p className="text-zinc-700 text-[11px] font-medium">&copy; {new Date().getFullYear()} Insound</p>
      </div>
    </footer>
  )
}
