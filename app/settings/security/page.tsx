import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SecuritySettingsClient } from './SecuritySettingsClient'

export const metadata = { title: 'Security Settings | Insound' }

export default async function SecuritySettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  return <SecuritySettingsClient />
}
