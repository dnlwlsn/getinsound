'use client'

import { useState } from 'react'

export default function HowToListen() {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(!open)}
        className="text-[11px] text-zinc-500 hover:text-zinc-300 font-bold transition-colors flex items-center gap-1.5 mx-auto"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? 'rotate-90' : ''}`}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        How to listen to your downloads
      </button>

      {open && (
        <div className="mt-3 text-[11px] text-zinc-500 leading-relaxed space-y-3 max-w-sm mx-auto">
          <div>
            <p className="text-zinc-400 font-bold mb-0.5">iPhone</p>
            <p>
              Open downloaded files in the <strong className="text-zinc-400">Files</strong> app and tap to play.
              To add to Apple Music, import via the Music app on your Mac or PC — they&apos;ll sync to your phone
              via iCloud.
            </p>
          </div>
          <div>
            <p className="text-zinc-400 font-bold mb-0.5">Android</p>
            <p>
              Open your Downloads folder — most music players detect new files automatically.
              Apps like <strong className="text-zinc-400">VLC</strong> or <strong className="text-zinc-400">Poweramp</strong> play
              any format.
            </p>
          </div>
          <div>
            <p className="text-zinc-400 font-bold mb-0.5">Desktop</p>
            <p>
              Double-click to play in your default music app, or drag files into Apple Music, VLC,
              or any player you like.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
