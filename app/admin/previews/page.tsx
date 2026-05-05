import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackfillPreviews } from './BackfillPreviews'

export default async function AdminPreviewsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: admin } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()
  if (!admin) redirect('/')

  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <h1 className="text-lg font-black uppercase tracking-widest text-white mb-2">Preview Backfill</h1>
      <p className="text-sm text-zinc-400 mb-8">
        Generate 30-second MP3 previews for tracks that don&apos;t have one yet.
        This runs in your browser — each track is downloaded, trimmed, encoded, and re-uploaded.
      </p>
      <BackfillPreviews />
    </div>
  )
}
