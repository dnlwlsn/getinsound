'use client'

import { useState, useEffect, useCallback } from 'react'

type Props = {
  words: string[]
  typingSpeed?: number
  deletingSpeed?: number
  pauseDuration?: number
  className?: string
}

export function TypewriterCycler({
  words,
  typingSpeed = 80,
  deletingSpeed = 40,
  pauseDuration = 2000,
  className = '',
}: Props) {
  const [index, setIndex] = useState(0)
  const [text, setText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const tick = useCallback(() => {
    const currentWord = words[index]

    if (!isDeleting) {
      setText(currentWord.slice(0, text.length + 1))
      if (text.length + 1 === currentWord.length) {
        setTimeout(() => setIsDeleting(true), pauseDuration)
        return
      }
    } else {
      setText(currentWord.slice(0, text.length - 1))
      if (text.length - 1 === 0) {
        setIsDeleting(false)
        setIndex((i) => (i + 1) % words.length)
        return
      }
    }
  }, [text, isDeleting, index, words, pauseDuration])

  useEffect(() => {
    const speed = isDeleting ? deletingSpeed : typingSpeed
    const timer = setTimeout(tick, speed)
    return () => clearTimeout(timer)
  }, [tick, isDeleting, deletingSpeed, typingSpeed])

  return (
    <span className={className}>
      <span id="typewriterText">{text}</span>
      <span className="tw-caret">|</span>
    </span>
  )
}
