'use client'

import { useState, useRef, useEffect } from 'react'
import { usePlayerStore } from '@/lib/stores/player'

const CATEGORIES = [
  { value: 'bug', label: 'Something\'s broken', icon: '⚠' },
  { value: 'feature_request', label: 'Feature idea', icon: '💡' },
  { value: 'general', label: 'General feedback', icon: '💬' },
] as const

type Category = typeof CATEGORIES[number]['value']

export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<Category | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasTrack = usePlayerStore(s => !!s.currentTrack)

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const hasModal = document.querySelector('[role="dialog"], [data-modal]') !== null
      setModalOpen(prev => prev === hasModal ? prev : hasModal)
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  useEffect(() => {
    if (category && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [category])

  function reset() {
    setCategory(null)
    setMessage('')
    setSending(false)
    setSent(false)
  }

  async function handleSubmit() {
    if (!category || !message.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message: message.trim(),
          pageUrl: window.location.pathname,
        }),
      })
      if (res.ok) {
        setSent(true)
        setTimeout(() => {
          setOpen(false)
          setTimeout(reset, 300)
        }, 1500)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div ref={ref} className={`fixed right-4 z-30 sm:bottom-6 transition-opacity duration-200 ${modalOpen ? 'opacity-0 pointer-events-none' : ''} ${hasTrack ? 'bottom-[160px]' : 'bottom-[80px]'}`}>
      {open && (
        <div className="absolute bottom-12 right-0 w-80 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          {sent ? (
            <div className="p-6 text-center">
              <p className="text-lg font-bold text-zinc-100">Thanks!</p>
              <p className="text-sm text-zinc-400 mt-1">Your feedback means a lot.</p>
            </div>
          ) : !category ? (
            <div className="p-4">
              <p className="text-sm font-bold text-zinc-100 mb-3">What's on your mind?</p>
              <div className="space-y-2">
                {CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className="w-full text-left px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm text-zinc-200 flex items-center gap-3"
                  >
                    <span className="text-base">{c.icon}</span>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4">
              <button
                onClick={() => setCategory(null)}
                className="text-xs text-zinc-500 hover:text-zinc-300 mb-2 flex items-center gap-1 transition-colors"
              >
                <span>&larr;</span> Back
              </button>
              <p className="text-sm font-bold text-zinc-100 mb-2">
                {CATEGORIES.find(c => c.value === category)?.icon}{' '}
                {CATEGORIES.find(c => c.value === category)?.label}
              </p>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us more..."
                maxLength={2000}
                rows={4}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm text-zinc-100 placeholder:text-zinc-500 resize-none focus:outline-none focus:border-zinc-500 transition-colors"
              />
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || sending}
                className="mt-2 w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:hover:bg-orange-600 text-sm font-bold text-black transition-colors"
              >
                {sending ? 'Sending...' : 'Send feedback'}
              </button>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => { setOpen(o => !o); if (open) setTimeout(reset, 300) }}
        className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-700 transition-all flex items-center justify-center shadow-lg"
        aria-label="Send feedback"
        title="Send feedback"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    </div>
  )
}
