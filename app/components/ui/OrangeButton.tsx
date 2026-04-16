'use client'

import { type ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: string
  size?: 'sm' | 'md' | 'lg'
}

export function OrangeButton({ children, href, size = 'md', className = '', ...rest }: Props) {
  const sizes = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
  }

  const base = `inline-flex items-center justify-center font-semibold rounded-full
    bg-[#F56D00] text-[#0A0A0A] ${sizes[size]}
    hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]
    transition-all duration-150 ease-out
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
