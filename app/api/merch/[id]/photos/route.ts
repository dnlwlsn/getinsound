import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: merch } = await supabase
    .from('merch')
    .select('id, photos, artist_id')
    .eq('id', id)
    .eq('artist_id', user.id)
    .single()
  if (!merch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const currentPhotos: string[] = (merch.photos as string[]) || []
  if (currentPhotos.length >= 5) {
    return NextResponse.json({ error: 'Maximum 5 photos' }, { status: 400 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${user.id}/${id}/${currentPhotos.length}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from('merch-images')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: urlData } = supabase.storage.from('merch-images').getPublicUrl(path)
  const newPhotos = [...currentPhotos, urlData.publicUrl]

  const { error: updateErr } = await supabase
    .from('merch')
    .update({ photos: newPhotos })
    .eq('id', id)
    .eq('artist_id', user.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  return NextResponse.json({ url: urlData.publicUrl, photos: newPhotos })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const index = parseInt(searchParams.get('index') || '-1', 10)

  const { data: merch } = await supabase
    .from('merch')
    .select('id, photos, artist_id')
    .eq('id', id)
    .eq('artist_id', user.id)
    .single()
  if (!merch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const currentPhotos: string[] = (merch.photos as string[]) || []
  if (index < 0 || index >= currentPhotos.length) {
    return NextResponse.json({ error: 'Invalid photo index' }, { status: 400 })
  }

  const newPhotos = currentPhotos.filter((_, i) => i !== index)

  const { error } = await supabase
    .from('merch')
    .update({ photos: newPhotos })
    .eq('id', id)
    .eq('artist_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ photos: newPhotos })
}
