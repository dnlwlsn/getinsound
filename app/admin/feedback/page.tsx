import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin'
import { FeedbackClient } from './FeedbackClient'

export const metadata: Metadata = {
  title: 'Feedback — Admin — Insound',
}

export default async function FeedbackPage() {
  await requireAdmin()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  let { data, error } = await supabase
    .from('user_feedback')
    .select('*, fan_profiles:user_id(username, avatar_url)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Feedback fetch error (with join):', error)
    const fallback = await supabase
      .from('user_feedback')
      .select('*')
      .order('created_at', { ascending: false })
    data = (fallback.data || []).map((d: any) => ({ ...d, fan_profiles: null }))
    error = fallback.error
  }

  return <FeedbackClient initialItems={data || []} fetchError={error?.message || null} />
}
