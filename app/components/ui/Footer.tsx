import { CurrencySwitcher } from './CurrencySwitcher'

type FooterLink = {
  label: string
  href: string
}

type Props = {
  links?: FooterLink[]
  className?: string
}

export function Footer({ links = [], className = '' }: Props) {
  const year = new Date().getFullYear()

  return (
    <footer className={`border-t border-white/[0.06] py-12 px-6
 ${className}`}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Waveform logo text (no dot) */}
        <span className="font-display text-lg font-bold text-white
">
          insound
        </span>

        {/* Links */}
        {links.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-6">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors
"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}

        {/* Copyright */}
        <div className="flex items-center gap-4">
          <CurrencySwitcher />
          <p className="text-xs text-zinc-600">&copy; {year} Insound. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
