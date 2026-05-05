'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const HIDE_FOOTER_ROUTES = ['/signup', '/auth', '/welcome', '/become-an-artist']
const HIDE_FOOTER_PREFIXES = ['/redeem']

export function Footer() {
  const pathname = usePathname()

  const shouldHide =
    HIDE_FOOTER_ROUTES.includes(pathname) ||
    HIDE_FOOTER_PREFIXES.some(prefix => pathname.startsWith(prefix))

  if (shouldHide) return null

  return (
    <footer className="bg-zinc-950 border-t border-zinc-900 py-6 px-4 text-center text-zinc-500 text-xs">
      <div className="flex items-center justify-center gap-4">
        <Link href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy</Link>
        <span className="text-zinc-700">&middot;</span>
        <Link href="/terms" className="hover:text-zinc-300 transition-colors">Terms</Link>
        <span className="text-zinc-700">&middot;</span>
        <span>&copy; 2025 Insound</span>
      </div>
    </footer>
  )
}
