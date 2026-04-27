'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToParentElement } from '@dnd-kit/modifiers'
import type { FanPinned, FanBadge } from './types'

const BADGE_META: Record<string, { label: string; icon: string }> = {
  founding_fan: { label: 'Founding Fan', icon: '⭐' },
  limited_edition: { label: 'Limited Edition', icon: '💎' },
  early_supporter: { label: 'Early Supporter', icon: '🎵' },
}

function badgeLabel(type: string): string {
  return BADGE_META[type]?.label ?? type
}

function badgeIcon(type: string): string {
  return BADGE_META[type]?.icon ?? '🏷'
}

function PinnedCardContent({ pin, accent, badges }: {
  pin: FanPinned
  accent: string
  badges: FanBadge[]
}) {
  return (
    <>
      <Link href={`/${pin.releases.artists.slug}`}>
        {pin.releases.cover_url ? (
          <div className="aspect-square relative">
            <Image src={pin.releases.cover_url} alt={pin.releases.title} fill className="object-cover" />
          </div>
        ) : (
          <div className="aspect-square flex items-center justify-center" style={{ background: `${accent}11` }}>
            <svg width="48" height="48" fill="none" stroke={accent} strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
          </div>
        )}
        <div className="p-5">
          <p className="font-display font-bold truncate group-hover:text-white transition-colors">{pin.releases.title}</p>
          <p className="text-xs text-zinc-500 mt-1">{pin.releases.artists.name}</p>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ background: `${accent}15`, color: accent }}>
              {pin.releases.type}
            </span>
            {badges.map(b => (
              <span key={b.badge_type}
                className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-white/[0.06] text-zinc-400">
                {badgeIcon(b.badge_type)} {badgeLabel(b.badge_type)}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </>
  )
}

function SortableCard({ pin, accent, badges, onRemove }: {
  pin: FanPinned
  accent: string
  badges: FanBadge[]
  onRemove: (releaseId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pin.release_id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative bg-white/[0.02] ring-1 ring-white/[0.06] rounded-3xl overflow-hidden transition-all hover:ring-2"
    >
      <PinnedCardContent pin={pin} accent={accent} badges={badges} />
      <div
        {...attributes}
        {...listeners}
        className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center cursor-grab active:cursor-grabbing backdrop-blur-sm"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="text-white/70">
          <circle cx="4" cy="3" r="1.5" /><circle cx="10" cy="3" r="1.5" />
          <circle cx="4" cy="7" r="1.5" /><circle cx="10" cy="7" r="1.5" />
          <circle cx="4" cy="11" r="1.5" /><circle cx="10" cy="11" r="1.5" />
        </svg>
      </div>
      <button
        onClick={(e) => { e.preventDefault(); onRemove(pin.release_id) }}
        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-600/80 flex items-center justify-center text-white text-sm backdrop-blur-sm hover:bg-red-500 transition-colors"
      >
        &times;
      </button>
    </div>
  )
}

export default function TopThreeShelfEditable({ pinned, badges, accent, onReorder, onRemove }: {
  pinned: FanPinned[]
  badges: FanBadge[]
  accent: string
  onReorder: (reordered: FanPinned[]) => void
  onRemove: (releaseId: string) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = pinned.findIndex(p => p.release_id === active.id)
    const newIndex = pinned.findIndex(p => p.release_id === over.id)
    const reordered = arrayMove(pinned, oldIndex, newIndex).map((pin, i) => ({
      ...pin,
      position: i + 1,
    }))
    onReorder(reordered)
  }, [pinned, onReorder])

  function getBadgesForRelease(releaseId: string): FanBadge[] {
    return badges.filter(b => b.release_id === releaseId)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={pinned.map(p => p.release_id)} strategy={horizontalListSortingStrategy}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {pinned.map(pin => (
            <SortableCard
              key={pin.release_id}
              pin={pin}
              accent={accent}
              badges={getBadgesForRelease(pin.release_id)}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
