import { PillLabel } from './PillLabel'

type Props = {
  pill: string
  heading: React.ReactNode
  className?: string
}

export function SectionHeader({ pill, heading, className = '' }: Props) {
  return (
    <div className={`text-center ${className}`}>
      <PillLabel className="mb-6">{pill}</PillLabel>
      <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[0.92]">
        {heading}
      </h2>
    </div>
  )
}
