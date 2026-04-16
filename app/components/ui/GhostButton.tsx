'use client'

import { type ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: string
  size?: 'sm' | 'md' | 'lg'
}

export function GhostButton({ children, href, size = 'md', className = '', ...rest }: Props) {
  const sizes = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
  }

  const base = `inline-flex items-center justify-center font-semibold rounded-full
    bg-transparent ring-1 ring-white/[0.12] text-white ${sizes[size]}
    hover:ring-white/[0.25] hover:bg-white/[0.04] active:scale-[0.98]
    transition-all duration-150 ease-out
    [html[data-theme=light]_&]:text-zinc-900 [html[data-theme=light]_&]:ring-zinc-300
    [html[data-theme=light]_&]:hover:ring-zinc-400 [html[data-theme=light]_&]:hover:bg-zinc-100
    disabled:opacity-50 disabled:pointer-events-none`

  if (href) {
    return (
      <a href={href} className={`${base} ${className}`}>
        {children}
      </a>
    )
  }

  return (
    <button className={`${base} ${className}`} {...rest}>
      {children}
    </button>
  )
}
