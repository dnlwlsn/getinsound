type Props = {
  balance: string
  message?: string
  className?: string
}

export function SoftNudge({
  balance,
  message = 'Your balance is ready to withdraw',
  className = '',
}: Props) {
  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-2xl
        bg-orange-600/[0.06] ring-1 ring-orange-600/[0.12]
        [html[data-theme=light]_&]:bg-orange-50 [html[data-theme=light]_&]:ring-orange-200
        ${className}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white [html[data-theme=light]_&]:text-zinc-900">
          {message}
        </p>
        <p className="font-display text-2xl font-bold text-orange-500 tracking-tight mt-0.5">
          {balance}
        </p>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400/60 shrink-0">
        Informational
      </span>
    </div>
  )
}
