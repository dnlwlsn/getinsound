type Props = {
  children: React.ReactNode
  className?: string
}

export function PillLabel({ children, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-2 bg-orange-600/[0.08] ring-1 ring-orange-600/[0.15]
        text-orange-400 text-[10px] font-bold uppercase tracking-[0.2em]
        px-4 py-2 rounded-full

 ${className}`}
    >
      {children}
    </span>
  )
}
