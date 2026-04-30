'use client'

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'

const ToastContext = createContext<(msg: string) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState('')
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setText(msg)
    setVisible(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setVisible(false), 2500)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        className={`fixed bottom-36 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 text-white px-5 py-3 rounded-full text-sm font-bold shadow-xl z-[300] transition-all duration-300 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {text}
      </div>
    </ToastContext.Provider>
  )
}
