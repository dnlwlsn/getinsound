import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SecuritySettingsClient } from './SecuritySettingsClient'
import { cookies } from 'next/headers'

export const metadata = { title: 'Security Settings | Insound' }

export default async function SecuritySettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signup')

  const cookieStore = await cookies()
  const currentSessionId = cookieStore.get('session_id')?.value || ''

  return <SecuritySettingsClient currentSessionId={currentSessionId} />
}
