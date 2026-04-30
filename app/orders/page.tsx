import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/app/components/ui/AppNav'
import OrdersClient from './OrdersClient'

export const metadata: Metadata = {
  title: 'My Orders | Insound',
  description: 'Track your merch orders, shipping status, and delivery history.',
}

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data } = await supabase
    .from('orders')
    .select(`
      *,
      merch ( name, photos ),
      artists ( name, slug, accent_colour )
    `)
    .eq('fan_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <>
      <AppNav />
      <OrdersClient orders={data ?? []} />
    </>
  )
}
