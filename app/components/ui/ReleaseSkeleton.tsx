'use client'

export function ReleaseCardSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${i >= 2 && i < 4 ? 'hidden md:block' : ''} ${i === 4 ? 'hidden lg:block' : ''}`}>
          <div className="aspect-square rounded-2xl skeleton-shimmer" />
          <div className="h-3.5 w-3/4 rounded-lg skeleton-shimmer mt-3" />
          <div className="h-2.5 w-1/2 rounded-lg skeleton-shimmer mt-2" />
          <div className="h-6 w-16 rounded-full skeleton-shimmer mt-2.5" />
        </div>
      ))}
    </div>
  )
}

export function ShelfSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-4 px-5 md:px-10 pb-2 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-[160px] sm:w-[180px]">
          <div className="aspect-square rounded-2xl skeleton-shimmer" />
          <div className="h-3.5 w-3/4 rounded-lg skeleton-shimmer mt-3" />
          <div className="h-2.5 w-1/2 rounded-lg skeleton-shimmer mt-2" />
        </div>
      ))}
    </div>
  )
}

export function ListItemSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 h-14 px-3">
          <div className="w-10 h-10 rounded-lg skeleton-shimmer flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-3.5 w-2/3 rounded-lg skeleton-shimmer" />
            <div className="h-2.5 w-1/3 rounded-lg skeleton-shimmer mt-1.5" />
          </div>
          <div className="w-12 h-4 rounded-lg skeleton-shimmer flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}
