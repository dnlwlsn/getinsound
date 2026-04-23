type RoadmapItem = {
  text: string
}

type RoadmapGroup = {
  title: string
  status: 'completed' | 'active' | 'upcoming'
  items: RoadmapItem[]
}

type Props = {
  groups: RoadmapGroup[]
  className?: string
}

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="absolute left-0 top-[0.45em]">
    <path d="M3 7l3 3 5-5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export function RoadmapSection({ groups, className = '' }: Props) {
  return (
    <div className={`grid gap-8 md:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {groups.map((group) => (
        <div key={group.title}>
          <div className="flex items-center gap-2 mb-4">
            {group.status === 'completed' && (
              <span className="w-2 h-2 rounded-full bg-green-500" />
            )}
            {group.status === 'active' && (
              <span className="w-2 h-2 rounded-full bg-[#F56D00]" />
            )}
            {group.status === 'upcoming' && (
              <span className="w-2 h-2 rounded-full bg-zinc-600" />
            )}
            <h3 className="font-display font-bold text-sm uppercase tracking-wider
              text-white">
              {group.title}
            </h3>
          </div>
          <ul className={`roadmap-list ${group.status === 'completed' ? 'done' : ''} ${group.status === 'active' ? 'active' : ''}`}>
            {group.items.map((item) => (
              <li key={item.text}>
                {group.status === 'completed' && <CheckIcon />}
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
