import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SalesClient } from './SalesClient'

export const metadata = { title: 'Sales & Payouts | Insound' }

export default async function SalesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  return <SalesClient />
}
