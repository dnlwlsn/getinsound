import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


// GET: list codes for a release
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const releaseId = req.nextUrl.searchParams.get('release_id')
  if (!releaseId) return NextResponse.json({ error: 'release_id required' }, { status: 400 })

  const { data: codes, error } = await supabase
    .from('download_codes')
    .select('id, code, redeemed_by, redeemed_at, expires_at, created_at')
    .eq('release_id', releaseId)
    .eq('artist_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const total = codes?.length || 0
  const redeemed = codes?.filter(c => c.redeemed_by !== null).length || 0

  return NextResponse.json({ codes, total, redeemed })
}

// POST: generate a batch of codes
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const releaseId = body.release_id as string | undefined
  const MAX_BATCH = 50
  const MAX_PER_RELEASE = 200
  const count = Math.min(Math.max(body.count || 10, 1), MAX_BATCH)
  const expiryDays = Math.min(Math.max(body.expiry_days || 90, 1), 365)

  if (!releaseId) return NextResponse.json({ error: 'release_id required' }, { status: 400 })

  // Verify the release belongs to this artist
  const { data: release } = await supabase
    .from('releases')
    .select('id')
    .eq('id', releaseId)
    .eq('artist_id', user.id)
    .maybeSingle()

  if (!release) return NextResponse.json({ error: 'Release not found' }, { status: 404 })

  const { count: existingCount } = await supabase
    .from('download_codes')
    .select('id', { count: 'exact', head: true })
    .eq('release_id', releaseId)
    .eq('artist_id', user.id)

  const currentTotal = existingCount ?? 0
  if (currentTotal >= MAX_PER_RELEASE) {
    return NextResponse.json({
      error: `You've reached the maximum of ${MAX_PER_RELEASE} codes for this release. Contact us if you need more.`,
    }, { status: 400 })
  }

  const allowedCount = Math.min(count, MAX_PER_RELEASE - currentTotal)

  const expiresAt = new Date(Date.now() + expiryDays * 86400000).toISOString()
  const codes = Array.from({ length: allowedCount }, () => ({
    release_id: releaseId,
    artist_id: user.id,
    code: generateCode(),
    expires_at: expiresAt,
  }))

  const { data, error } = await supabase
    .from('download_codes')
    .insert(codes)
    .select('id, code, expires_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ codes: data, count: data?.length })
}

// Generate a human-friendly code: INSND-XXXX-XXXX
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const randomBytes = new Uint8Array(8)
  crypto.getRandomValues(randomBytes)
  const segment = (offset: number) => Array.from({ length: 4 }, (_, i) =>
    chars[randomBytes[offset + i] % chars.length]
  ).join('')
  return `INSND-${segment(0)}-${segment(4)}`
}
