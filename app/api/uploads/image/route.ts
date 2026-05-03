import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rate-limit'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

// Magic-byte signatures for validating actual file content
const SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/webp': [], // handled separately: bytes 8-11 = "WEBP"
}

function detectMimeFromBytes(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 12) return null

  for (const [mime, sigs] of Object.entries(SIGNATURES)) {
    for (const sig of sigs) {
      if (sig.every((b, i) => bytes[i] === b)) return mime
    }
  }

  // WebP: starts with RIFF....WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp'
  }

  return null
}

type Bucket = 'avatars' | 'banners'
const VALID_BUCKETS: Bucket[] = ['avatars', 'banners']

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  const ipHash = await hashIp(ip)
  const limited = await checkRateLimit(ipHash, 'general', 20, 1)
  if (limited) return limited

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const bucket = formData.get('bucket') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!bucket || !VALID_BUCKETS.includes(bucket as Bucket)) {
    return NextResponse.json({ error: 'Invalid bucket — must be "avatars" or "banners"' }, { status: 400 })
  }

  // Size check
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 })
  }

  // Read bytes and validate magic bytes (not just Content-Type header)
  const arrayBuffer = await file.arrayBuffer()
  const detectedMime = detectMimeFromBytes(arrayBuffer)

  if (!detectedMime || !ALLOWED_TYPES.includes(detectedMime)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 })
  }

  // Look up artist_id for this user
  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('id', user.id)
    .single()
  if (!artist) return NextResponse.json({ error: 'Artist not found' }, { status: 404 })

  const typedBucket = bucket as Bucket
  const label = typedBucket === 'avatars' ? 'avatar' : 'banner'
  const extMap: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  const ext = extMap[detectedMime] || 'jpg'
  const path = `${artist.id}/${label}.${ext}`

  // Remove any existing files in this user's folder within the bucket
  const { data: existing } = await supabase.storage.from(typedBucket).list(artist.id)
  if (existing?.length) {
    await supabase.storage.from(typedBucket).remove(existing.map(f => `${artist.id}/${f.name}`))
  }

  // Upload with validated content type
  const { error: uploadErr } = await supabase.storage
    .from(typedBucket)
    .upload(path, arrayBuffer, { upsert: true, contentType: detectedMime })
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: urlData } = supabase.storage.from(typedBucket).getPublicUrl(path)
  const url = `${urlData.publicUrl}?t=${Date.now()}`

  // Update the artist record
  const column = typedBucket === 'avatars' ? 'avatar_url' : 'banner_url'
  const { error: updateErr } = await supabase
    .from('artists')
    .update({ [column]: url })
    .eq('id', artist.id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ url })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const bucket = searchParams.get('bucket') as string | null

  if (!bucket || !VALID_BUCKETS.includes(bucket as Bucket)) {
    return NextResponse.json({ error: 'Invalid bucket — must be "avatars" or "banners"' }, { status: 400 })
  }

  const typedBucket = bucket as Bucket

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('id', user.id)
    .single()
  if (!artist) return NextResponse.json({ error: 'Artist not found' }, { status: 404 })

  const { data: existing } = await supabase.storage.from(typedBucket).list(artist.id)
  if (existing?.length) {
    await supabase.storage.from(typedBucket).remove(existing.map(f => `${artist.id}/${f.name}`))
  }

  const column = typedBucket === 'avatars' ? 'avatar_url' : 'banner_url'
  const { error } = await supabase
    .from('artists')
    .update({ [column]: null })
    .eq('id', artist.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
