import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024

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
  if (currentPhotos.length >= 3) {
    return NextResponse.json({ error: 'Maximum 3 photos per item' }, { status: 400 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${user.id}/${id}/${crypto.randomUUID()}.${ext}`

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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 })
  }

  const oldUrl = currentPhotos[index]
  const bucketBase = '/storage/v1/object/public/merch-images/'
  const pathIndex = oldUrl.indexOf(bucketBase)
  if (pathIndex !== -1) {
    const storagePath = oldUrl.slice(pathIndex + bucketBase.length)
    await supabase.storage.from('merch-images').remove([storagePath])
  }

  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${user.id}/${id}/${crypto.randomUUID()}.${ext}`
  const { error: uploadErr } = await supabase.storage
    .from('merch-images')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: urlData } = supabase.storage.from('merch-images').getPublicUrl(path)
  const newPhotos = [...currentPhotos]
  newPhotos[index] = urlData.publicUrl

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
  if (index === 0) {
    return NextResponse.json({ error: 'Cannot remove the primary image — replace it instead' }, { status: 400 })
  }

  const photoUrl = currentPhotos[index]
  const bucketBase = '/storage/v1/object/public/merch-images/'
  const pathIndex = photoUrl.indexOf(bucketBase)
  if (pathIndex !== -1) {
    const storagePath = photoUrl.slice(pathIndex + bucketBase.length)
    await supabase.storage.from('merch-images').remove([storagePath])
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
