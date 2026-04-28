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

  const { data } = await supabase
    .from('user_feedback')
    .select('*, fan_profiles:user_id(username, avatar_url)')
    .order('created_at', { ascending: false })

  return <FeedbackClient initialItems={data || []} />
}
