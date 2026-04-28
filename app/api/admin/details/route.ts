import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const type = req.nextUrl.searchParams.get('type')
  const supabase = getAdmin()

  switch (type) {
    case 'fans': {
      const { data } = await supabase
        .from('fan_profiles')
        .select('id, username, avatar_url, created_at, is_public')
        .order('created_at', { ascending: false })
        .limit(200)
      return NextResponse.json({ rows: (data ?? []).map(f => ({
        id: f.id,
        name: f.username || 'No username',
        url: f.username ? `/@${f.username}` : null,
        avatar: f.avatar_url,
        created: f.created_at,
        public: f.is_public,
      }))})
    }

    case 'artists': {
      const { data } = await supabase
        .from('artists')
        .select('id, name, slug, avatar_url, created_at')
        .order('created_at', { ascending: false })
        .limit(200)
      return NextResponse.json({ rows: (data ?? []).map(a => ({
        id: a.id,
        name: a.name,
        url: `/${a.slug}`,
        avatar: a.avatar_url,
        created: a.created_at,
      }))})
    }

    case 'releases': {
      const { data } = await supabase
        .from('releases')
        .select('id, title, slug, type, cover_url, created_at, artists!inner(name, slug)')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(200)
      return NextResponse.json({ rows: (data ?? []).map(r => {
        const artist = r.artists as unknown as { name: string; slug: string }
        return {
          id: r.id,
          name: `${r.title} — ${artist.name}`,
          url: `/release?a=${artist.slug}&r=${r.slug}`,
          avatar: r.cover_url,
          created: r.created_at,
          type: r.type,
        }
      })})
    }

    case 'sales': {
      const { data } = await supabase
        .from('purchases')
        .select('id, amount_pence, currency, created_at, releases(title, slug, artists!inner(name, slug)), fan_profiles(username)')
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(200)
      return NextResponse.json({ rows: (data ?? []).map(p => {
        const release = p.releases as unknown as { title: string; slug: string; artists: { name: string; slug: string } } | null
        const fan = p.fan_profiles as unknown as { username: string | null } | null
        return {
          id: p.id,
          name: release ? `${release.title} — ${release.artists.name}` : 'Unknown release',
          sub: fan?.username ? `@${fan.username}` : 'Anonymous',
          amount: p.amount_pence,
          currency: p.currency,
          created: p.created_at,
        }
      })})
    }

    case 'waitlist': {
      const { data } = await supabase
        .from('waitlist')
        .select('id, email, created_at')
        .order('created_at', { ascending: false })
        .limit(200)
      return NextResponse.json({ rows: (data ?? []).map(w => ({
        id: w.id,
        name: w.email,
        created: w.created_at,
      }))})
    }

    default:
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  }
}

const DELETABLE: Record<string, string> = {
  artists: 'artists',
  fans: 'fan_profiles',
  releases: 'releases',
  waitlist: 'waitlist',
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { type, id } = await req.json().catch(() => ({} as any))
  if (!type || !id) return NextResponse.json({ error: 'type and id required' }, { status: 400 })

  const table = DELETABLE[type]
  if (!table) return NextResponse.json({ error: 'Cannot delete this type' }, { status: 400 })

  const supabase = getAdmin()
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
