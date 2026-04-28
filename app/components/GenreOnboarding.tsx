'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GenreMoodBoard, type Genre } from './ui/GenreMoodBoard'

/**
 * Renders the genre mood board once after first purchase.
 * Mount this in the layout between auth check and library/discover pages.
 * It self-hides once preferences are saved or skipped.
 */
export function GenreOnboarding({ redirectTo = '/library' }: { redirectTo?: string }) {
  const [show, setShow] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check if fan already has preferences or skipped
      const { data: profile } = await supabase
        .from('fan_profiles')
        .select('preferences_skipped')
        .eq('id', user.id)
        .maybeSingle()

      if (profile) return // already completed or skipped

      // Check if fan already has genre selections
      const { count } = await supabase
        .from('fan_preferences')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if (count && count > 0) return // already has preferences

      // Check if they've made at least one purchase
      const { count: purchaseCount } = await supabase
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('buyer_user_id', user.id)
        .eq('status', 'paid')

      if (!purchaseCount || purchaseCount === 0) return

      setShow(true)
    }

    check()
  }, [supabase])

  const [error, setError] = useState<string | null>(null)

  async function handleComplete(genres: Genre[]) {
    setError(null)
    try {
      const res = await fetch('/api/fan-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genres }),
      })
      if (res.ok) {
        setShow(false)
        router.push(redirectTo)
      } else {
        setError('We couldn\'t save your preferences - please try again.')
      }
    } catch {
      setError('We couldn\'t save your preferences - please try again.')
    }
  }

  async function handleSkip() {
    setError(null)
    try {
      const res = await fetch('/api/fan-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skip: true }),
      })
      if (res.ok) {
        setShow(false)
        router.push(redirectTo)
      } else {
        setError('We couldn\'t save your preferences - please try again.')
      }
    } catch {
      setError('We couldn\'t save your preferences - please try again.')
    }
  }

  if (!show) return null

  return (
    <>
      <GenreMoodBoard onComplete={handleComplete} onSkip={handleSkip} />
      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-red-600 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg">
          {error}
        </div>
      )}
    </>
  )
}
