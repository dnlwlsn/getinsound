'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Profile', href: '/settings/profile' },
  { label: 'Account', href: '/settings/account' },
  { label: 'Security', href: '/settings/security' },
]

export function SettingsTabs() {
  const pathname = usePathname()

  return (
    <div className="flex gap-6 border-b border-zinc-800 mb-8">
      {TABS.map(tab => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`pb-3 text-sm font-bold transition-colors ${
              active
                ? 'text-orange-500 border-b-2 border-orange-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
