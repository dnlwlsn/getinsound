type Props = {
  amount: string
  label: string
  highlight?: boolean
  className?: string
}

export function BreakdownCard({ amount, label, highlight = false, className = '' }: Props) {
  return (
    <div
      className={`rounded-2xl p-5 text-center ring-1
        ${highlight
          ? 'bg-orange-600/[0.08] ring-orange-600/[0.15]'
          : 'bg-white/[0.02] ring-white/[0.06]'}
        ${className}`}
    >
      <p className={`font-display text-2xl md:text-3xl font-bold tracking-tight
        ${highlight ? 'text-orange-500' : 'text-white'}`}>
        {amount}
      </p>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 mt-1">
        {label}
      </p>
    </div>
  )
}
