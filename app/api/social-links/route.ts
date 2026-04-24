import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { type SocialPlatform, type SocialLinks } from '@/lib/verification'


export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platform } = await req.json() as { platform: SocialPlatform }

  const { data: current } = await supabase
    .from('artists')
    .select('social_links')
    .eq('id', user.id)
    .single()

  const links: SocialLinks = (current?.social_links as SocialLinks) || {}
  delete links[platform]

  const { error } = await supabase
    .from('artists')
    .update({ social_links: Object.keys(links).length > 0 ? links : null })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
