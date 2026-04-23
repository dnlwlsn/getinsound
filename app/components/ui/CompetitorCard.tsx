type ComparisonRow = {
  label: string
  them: string
  us: string
}

type Props = {
  number: string
  name: string
  subtitle: string
  rows: ComparisonRow[]
  className?: string
}

export function CompetitorCard({ number, name, subtitle, rows, className = '' }: Props) {
  return (
    <article className={`compare-card border rounded-3xl overflow-hidden ${className}`}>
      <div className="px-6 pt-6 pb-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] t-faint">{number}</p>
        <p className="font-display text-xl font-bold text-white mt-1
">
          {name}
        </p>
        <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="grid grid-cols-2 mt-4">
        <div className="col-bad p-5 border-t border-r border-white/[0.04]">
          <p className="text-[9px] font-bold uppercase tracking-widest text-red-400/70 mb-4">Them</p>
          <div className="space-y-4">
            {rows.map((row) => (
              <div key={row.label}>
                <p className="text-[10px] text-zinc-600 mb-1">{row.label}</p>
                <p className="font-bold text-red-400 text-xs leading-snug">{row.them}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="col-good p-5 border-t border-white/[0.04]">
          <p className="text-[9px] font-bold uppercase tracking-widest text-orange-400 mb-4">insound.</p>
          <div className="space-y-4">
            {rows.map((row) => (
              <div key={row.label}>
                <p className="text-[10px] text-zinc-600 mb-1">{row.label}</p>
                <p className="font-bold text-orange-400 text-xs leading-snug">{row.us}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  )
}
