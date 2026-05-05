import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rate-limit'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req.headers)
  const ipHash = await hashIp(ip)
  const limited = await checkRateLimit(ipHash, 'general', 10, 1)
  if (limited) return limited

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user ?? null
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { id: releaseId } = await params

  const body = await req.json().catch(() => null)
  if (!body || typeof body.price_pence !== 'number' || !Number.isInteger(body.price_pence)) {
    return NextResponse.json({ error: 'price_pence must be an integer' }, { status: 400 })
  }

  const { data: release } = await supabase
    .from('releases')
    .select('id, artist_id, pwyw_enabled')
    .eq('id', releaseId)
    .eq('artist_id', user.id)
    .maybeSingle()

  if (!release) return NextResponse.json({ error: 'Release not found' }, { status: 404 })

  const { price_pence, pwyw_enabled, pwyw_minimum_pence } = body
  const effectivePwyw = typeof pwyw_enabled === 'boolean' ? pwyw_enabled : release.pwyw_enabled

  if (effectivePwyw) {
    if (price_pence < 300 || price_pence > 10_000_000) {
      return NextResponse.json({ error: 'PWYW suggested price must be at least £3.00' }, { status: 400 })
    }
    if (pwyw_minimum_pence == null) {
      return NextResponse.json({ error: 'PWYW minimum is required when PWYW is enabled' }, { status: 400 })
    }
    if (!Number.isInteger(pwyw_minimum_pence) || pwyw_minimum_pence < 300 || pwyw_minimum_pence > 10_000_000) {
      return NextResponse.json({ error: 'PWYW minimum must be at least £3.00' }, { status: 400 })
    }
  } else {
    if (price_pence < 300 || price_pence > 10_000_000) {
      return NextResponse.json({ error: 'Price must be between £3.00 and £100,000' }, { status: 400 })
    }
  }

  const updateFields: Record<string, unknown> = { price_pence }
  if (typeof pwyw_enabled === 'boolean') updateFields.pwyw_enabled = pwyw_enabled
  if (pwyw_minimum_pence !== undefined) updateFields.pwyw_minimum_pence = pwyw_minimum_pence ?? null

  const { error: updateErr } = await supabase
    .from('releases')
    .update(updateFields)
    .eq('id', releaseId)
    .eq('artist_id', user.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
