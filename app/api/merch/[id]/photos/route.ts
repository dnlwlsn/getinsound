import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024

function detectMimeFromBytes(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 12) return null
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp'
  return null
}

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

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const detectedMime = detectMimeFromBytes(arrayBuffer)
  if (!detectedMime || !ALLOWED_TYPES.includes(detectedMime)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 })
  }

  const extMap: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  const ext = extMap[detectedMime] || 'jpg'
  const path = `${user.id}/${id}/${crypto.randomUUID()}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from('merch-images')
    .upload(path, arrayBuffer, { upsert: true, contentType: detectedMime })
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
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 })
  }

  const putBuffer = await file.arrayBuffer()
  const putDetectedMime = detectMimeFromBytes(putBuffer)
  if (!putDetectedMime || !ALLOWED_TYPES.includes(putDetectedMime)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 })
  }

  const oldUrl = currentPhotos[index]
  const bucketBase = '/storage/v1/object/public/merch-images/'
  const pathIndex = oldUrl.indexOf(bucketBase)
  if (pathIndex !== -1) {
    const storagePath = oldUrl.slice(pathIndex + bucketBase.length)
    await supabase.storage.from('merch-images').remove([storagePath])
  }

  const extMap2: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  const ext = extMap2[putDetectedMime] || 'jpg'
  const path = `${user.id}/${id}/${crypto.randomUUID()}.${ext}`
  const { error: uploadErr } = await supabase.storage
    .from('merch-images')
    .upload(path, putBuffer, { upsert: true, contentType: putDetectedMime })
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
