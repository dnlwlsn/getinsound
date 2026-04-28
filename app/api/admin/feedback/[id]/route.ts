import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminApi } from '@/lib/admin'

const VALID_STATUSES = ['new', 'noted', 'done', 'dismissed'] as const

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { status, admin_notes } = body

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { error } = await supabase
    .from('user_feedback')
    .update({
      status,
      admin_notes: admin_notes ?? null,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
