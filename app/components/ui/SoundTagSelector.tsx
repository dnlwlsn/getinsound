'use client'

import { useState } from 'react'
import { SOUNDS, SOUNDS_SET, MAX_RELEASE_TAGS, MAX_TAG_LENGTH } from '@/lib/sounds'

interface Props {
  selected: string[]
  onChange: (tags: string[]) => void
}

export function SoundTagSelector({ selected, onChange }: Props) {
  const [showCustom, setShowCustom] = useState(false)
  const [customValue, setCustomValue] = useState('')

  const atMax = selected.length >= MAX_RELEASE_TAGS

  function toggle(tag: string) {
    if (selected.includes(tag)) {
      onChange(selected.filter(t => t !== tag))
    } else if (!atMax) {
      onChange([...selected, tag])
    }
  }

  function addCustom() {
    const cleaned = customValue.trim().toLowerCase().slice(0, MAX_TAG_LENGTH)
    if (!cleaned) return
    if (selected.includes(cleaned)) return
    if (selected.some(s => s.toLowerCase() === cleaned)) return
    if (atMax) return
    onChange([...selected, cleaned])
    setCustomValue('')
    setShowCustom(false)
  }

  return (
    <div>
      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">
        What does this sound like?
      </label>
      <p className="text-[10px] text-zinc-600 mb-3">
        Adding your sound helps fans discover your music.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        {SOUNDS.map(sound => {
          const isSelected = selected.includes(sound)
          const disabled = atMax && !isSelected
          return (
            <button
              key={sound}
              type="button"
              disabled={disabled}
              onClick={() => toggle(sound)}
              className={`
                px-3 py-1.5 rounded-full text-xs font-bold transition-all
                border
                ${isSelected
                  ? 'bg-[#F56D00]/15 border-[#F56D00] text-[#F56D00]'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                }
                ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {sound}
              {isSelected && <span className="ml-1.5 text-[#F56D00]">✓</span>}
            </button>
          )
        })}

        {selected
          .filter(t => !SOUNDS_SET.has(t))
          .map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className="px-3 py-1.5 rounded-full text-xs font-bold transition-all border bg-[#F56D00]/15 border-[#F56D00] text-[#F56D00] cursor-pointer"
            >
              {tag}
              <span className="ml-1.5">✓</span>
            </button>
          ))}
      </div>

      {showCustom ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={customValue}
            onChange={e => setCustomValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
            maxLength={MAX_TAG_LENGTH}
            placeholder="e.g. shoegaze"
            autoFocus
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg py-2 px-3 text-sm text-white placeholder-zinc-700 focus:border-orange-600 outline-none transition-colors"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!customValue.trim() || atMax}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => { setShowCustom(false); setCustomValue('') }}
            className="px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        !atMax && (
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className="text-[10px] font-bold text-zinc-500 hover:text-orange-500 transition-colors"
          >
            + Add custom sound
          </button>
        )
      )}

      <p className="text-[10px] text-zinc-600 mt-2">
        {selected.length} of {MAX_RELEASE_TAGS} selected
        {selected.length === 0 && ' · optional'}
      </p>
    </div>
  )
}
