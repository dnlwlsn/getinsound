import Link from 'next/link'

const SIZES = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
} as const

export function InsoundLogo({
  size = 'sm',
  href = '/',
  className = '',
}: {
  size?: keyof typeof SIZES
  href?: string
  className?: string
}) {
  const classes = `font-display font-black text-orange-600 tracking-tighter hover:text-orange-500 transition-colors ${SIZES[size]} ${className}`

  return (
    <Link href={href} className={classes}>
      insound.
    </Link>
  )
}
