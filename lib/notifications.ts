import { SupabaseClient } from '@supabase/supabase-js'

export type NotificationType =
  | 'new_release' | 'preorder_ready' | 'order_dispatched' | 'artist_post'
  | 'sale' | 'first_sale' | 'preorder' | 'merch_order' | 'code_redeemed' | 'zero_fees_unlocked'
  | 'merch_dispatched' | 'merch_delivered' | 'merch_return' | 'merch_dispute'

interface CreateNotificationParams {
  supabase: SupabaseClient
  userId: string
  type: NotificationType
  title: string
  body?: string
  link?: string
}

export async function createNotification({
  supabase, userId, type, title, body, link,
}: CreateNotificationParams): Promise<void> {
  const { data: pref } = await supabase
    .from('notification_preferences')
    .select('in_app')
    .eq('user_id', userId)
    .eq('type', type)
    .maybeSingle()

  if (pref && !pref.in_app) return

  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body: body ?? null,
    link: link ?? null,
  })
}

export async function shouldSendEmail({
  supabase, userId, type,
}: Pick<CreateNotificationParams, 'supabase' | 'userId' | 'type'>): Promise<boolean> {
  const { data: pref } = await supabase
    .from('notification_preferences')
    .select('email')
    .eq('user_id', userId)
    .eq('type', type)
    .maybeSingle()

  return !pref || pref.email !== false
}

export async function createNotificationBatch({
  supabase, userIds, type, title, body, link,
}: Omit<CreateNotificationParams, 'userId'> & { userIds: string[] }): Promise<void> {
  if (userIds.length === 0) return

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('user_id')
    .in('user_id', userIds)
    .eq('type', type)
    .eq('in_app', false)

  const suppressed = new Set((prefs ?? []).map(p => p.user_id))
  const rows = userIds
    .filter(id => !suppressed.has(id))
    .map(user_id => ({
      user_id,
      type,
      title,
      body: body ?? null,
      link: link ?? null,
    }))

  if (rows.length === 0) return
  await supabase.from('notifications').insert(rows)
}
