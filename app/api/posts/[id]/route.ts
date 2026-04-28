import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: post } = await supabase
    .from('artist_posts')
    .select('id, media_url, artist_id')
    .eq('id', id)
    .eq('artist_id', user.id)
    .maybeSingle()

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  if (post.media_url) {
    const url = new URL(post.media_url)
    const pathMatch = url.pathname.match(/\/post-media\/(.+)$/)
    if (pathMatch) {
      await supabase.storage.from('post-media').remove([pathMatch[1]])
    }
  }

  const { error } = await supabase
    .from('artist_posts')
    .delete()
    .eq('id', id)
    .eq('artist_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
