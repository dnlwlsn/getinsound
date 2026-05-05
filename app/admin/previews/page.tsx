import { BackfillPreviews } from './BackfillPreviews'

export default function AdminPreviewsPage() {
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
