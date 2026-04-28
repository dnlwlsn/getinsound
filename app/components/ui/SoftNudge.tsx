type Props = {
  balance: string
  className?: string
}

export function SoftNudge({
  balance,
  className = '',
}: Props) {
  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-2xl
        bg-orange-600/[0.06] ring-1 ring-orange-600/[0.12]

        ${className}`}
    >
      <div className="flex-1 min-w-0">
        <p className="font-display text-2xl font-bold text-orange-500 tracking-tight">
          {balance}
        </p>
        <p className="text-sm text-zinc-400 mt-1">
          Below Stripe's minimum — your balance will be paid out automatically once it reaches the threshold.
        </p>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400/60 shrink-0">
        Pending
      </span>
    </div>
  )
}
