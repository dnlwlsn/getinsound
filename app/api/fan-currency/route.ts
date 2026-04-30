import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SUPPORTED_CURRENCIES } from '@/app/lib/currency'

const VALID_CODES = new Set(SUPPORTED_CURRENCIES.map(c => c.code))

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('fan_profiles')
    .select('display_currency, locale')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || { display_currency: 'GBP', locale: null })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { display_currency, locale } = body

  if (!display_currency || !VALID_CODES.has(display_currency)) {
    return NextResponse.json({ error: 'Invalid or unsupported currency' }, { status: 400 })
  }

  const { error } = await supabase
    .from('fan_profiles')
    .update({
      display_currency,
      locale: locale || null,
    })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
