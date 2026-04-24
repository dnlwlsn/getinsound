import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = 'mailto:hello@getinsound.com'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

import webpush from 'npm:web-push@3.6.7'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

interface PushPayload {
  user_ids: string[]
  title: string
  body: string
  url?: string
  tag?: string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const payload: PushPayload = await req.json()
  const { user_ids, title, body, url, tag } = payload

  if (!user_ids?.length || !title) {
    return new Response('Missing user_ids or title', { status: 400 })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: subscriptions } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, keys_p256dh, keys_auth')
    .in('user_id', user_ids)

  if (!subscriptions?.length) {
    return Response.json({ sent: 0, failed: 0 })
  }

  const pushPayload = JSON.stringify({ title, body, url, tag })
  let sent = 0
  let failed = 0
  const staleIds: string[] = []

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys_p256dh,
            auth: sub.keys_auth,
          },
        },
        pushPayload
      )
      sent++
    } catch (err: any) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        staleIds.push(sub.id)
      }
      failed++
    }
  }

  if (staleIds.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', staleIds)
  }

  return Response.json({ sent, failed, cleaned: staleIds.length })
})
