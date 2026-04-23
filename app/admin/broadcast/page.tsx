import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin'
import BroadcastClient from './BroadcastClient'

export const runtime = 'edge'
export const metadata: Metadata = {
  title: 'Broadcast — Admin',
}

export default async function BroadcastPage() {
  const { supabase, user } = await requireAdmin()

  const { data: account } = await supabase
    .from('artist_accounts')
    .select('email')
    .eq('id', user.id)
    .single()

  return <BroadcastClient adminEmail={account!.email} />
}
