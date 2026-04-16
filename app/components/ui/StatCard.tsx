type Props = {
  value: string
  label: string
  className?: string
}

export function StatCard({ value, label, className = '' }: Props) {
  return (
    <div className={`text-center ${className}`}>
      <p className="font-display text-4xl md:text-5xl font-bold tracking-tight text-white
        [html[data-theme=light]_&]:text-zinc-900">
        {value}
      </p>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 mt-2
        [html[data-theme=light]_&]:text-zinc-500">
        {label}
      </p>
    </div>
  )
}
