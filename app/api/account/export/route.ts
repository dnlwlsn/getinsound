import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireFreshAuth } from '@/lib/fresh-auth'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const freshAuthError = await requireFreshAuth(request, user.id)
  if (freshAuthError) return freshAuthError

  const userId = user.id

  const [
    profileRes,
    artistRes,
    artistAccountRes,
    purchasesRes,
    ordersRes,
    preferencesRes,
    wishlistRes,
    favouritesRes,
    notificationsRes,
    notifPrefsRes,
    sessionsRes,
    badgesRes,
    pinnedRes,
    hiddenRes,
  ] = await Promise.all([
    supabase.from('fan_profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('artists').select('id, slug, name, bio, avatar_url, banner_url, accent_colour, created_at, updated_at').eq('id', userId).maybeSingle(),
    supabase.from('artist_accounts').select('email, country, self_attest_independent, independence_confirmed, independence_confirmed_at, stripe_onboarded, created_at, updated_at').eq('id', userId).maybeSingle(),
    supabase.from('purchases').select('id, release_id, amount_pence, fan_currency, fan_amount, status, pre_order, release_date, paid_at, digital_content_consent_at, created_at, releases(title, slug, artists(name, slug))').eq('buyer_user_id', userId).order('created_at', { ascending: false }),
    supabase.from('orders').select('id, merch_id, variant_selected, amount_paid, amount_paid_currency, postage_paid, shipping_address, tracking_number, carrier, status, created_at, dispatched_at, delivered_at, merch(name, artist_id, artists(name, slug))').eq('fan_id', userId).order('created_at', { ascending: false }),
    supabase.from('fan_preferences').select('*').eq('user_id', userId),
    supabase.from('fan_wishlist').select('release_id, created_at, releases(title, slug, artists(name, slug))').eq('user_id', userId),
    supabase.from('favourites').select('track_id, release_id, created_at, tracks(title, releases(title, slug)), releases(title, slug)').eq('user_id', userId),
    supabase.from('notifications').select('id, type, title, body, link, read, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(500),
    supabase.from('notification_preferences').select('*').eq('user_id', userId),
    supabase.from('user_sessions').select('id, device, ip_display, city, country, last_active_at, created_at').eq('user_id', userId),
    supabase.from('fan_badges').select('badge_type, awarded_at').eq('user_id', userId),
    supabase.from('fan_pinned_releases').select('release_id, position, releases(title, slug, artists(name))').eq('user_id', userId),
    supabase.from('fan_hidden_purchases').select('purchase_id, created_at').eq('user_id', userId),
  ])

  const exportData = {
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
    profile: profileRes.data,
    artist: artistRes.data ? {
      ...artistRes.data,
      account: artistAccountRes.data,
    } : null,
    purchases: purchasesRes.data ?? [],
    merch_orders: ordersRes.data ?? [],
    preferences: preferencesRes.data ?? [],
    wishlist: wishlistRes.data ?? [],
    favourites: favouritesRes.data ?? [],
    notifications: notificationsRes.data ?? [],
    notification_preferences: notifPrefsRes.data ?? [],
    sessions: sessionsRes.data ?? [],
    badges: badgesRes.data ?? [],
    pinned_releases: pinnedRes.data ?? [],
    hidden_purchases: hiddenRes.data ?? [],
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="insound-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
