'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generatePreviewBlob } from '@/lib/audio-preview'

type TrackRow = {
  id: string
  audio_path: string
  release_id: string
  releases: { artist_id: string } | null
}

export function BackfillPreviews() {
  const [status, setStatus] = useState<string>('')
  const [log, setLog] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const abortRef = useRef(false)

  function appendLog(msg: string) {
    setLog(prev => [...prev, msg])
  }

  async function run() {
    setRunning(true)
    setLog([])
    abortRef.current = false

    const supabase = createClient()

    const { data: tracks, error } = await supabase
      .from('tracks')
      .select('id, audio_path, release_id, releases!inner(artist_id)')
      .is('preview_path', null)
      .not('audio_path', 'is', null)
      .order('created_at', { ascending: true })
      .limit(500)

    if (error || !tracks) {
      appendLog(`Error fetching tracks: ${error?.message}`)
      setRunning(false)
      return
    }

    appendLog(`Found ${tracks.length} tracks without previews`)

    let success = 0
    let failed = 0

    for (let i = 0; i < tracks.length; i++) {
      if (abortRef.current) {
        appendLog('Aborted by user')
        break
      }

      const track = tracks[i] as unknown as TrackRow
      const artistId = track.releases?.artist_id
      if (!artistId || !track.audio_path) {
        appendLog(`Skipping ${track.id} — missing artist or audio path`)
        failed++
        continue
      }

      setStatus(`Processing ${i + 1} / ${tracks.length}: ${track.id}`)

      try {
        const { data: signed, error: signErr } = await supabase.storage
          .from('masters')
          .createSignedUrl(track.audio_path, 600)

        if (signErr || !signed) {
          appendLog(`${track.id}: failed to get signed URL`)
          failed++
          continue
        }

        const resp = await fetch(signed.signedUrl)
        if (!resp.ok) {
          appendLog(`${track.id}: download failed (${resp.status})`)
          failed++
          continue
        }

        const blob = await resp.blob()
        const file = new File([blob], 'track.wav', { type: blob.type })
        const previewBlob = await generatePreviewBlob(file)

        const previewPath = `${artistId}/${track.release_id}-${track.id}.mp3`
        const { error: uploadErr } = await supabase.storage
          .from('previews')
          .upload(previewPath, previewBlob, { contentType: 'audio/mpeg', upsert: true })

        if (uploadErr) {
          appendLog(`${track.id}: upload failed — ${uploadErr.message}`)
          failed++
          continue
        }

        const { error: updateErr } = await supabase
          .from('tracks')
          .update({ preview_path: previewPath })
          .eq('id', track.id)

        if (updateErr) {
          appendLog(`${track.id}: DB update failed — ${updateErr.message}`)
          failed++
          continue
        }

        success++
        appendLog(`${track.id}: done`)
      } catch (e) {
        appendLog(`${track.id}: ${(e as Error).message}`)
        failed++
      }
    }

    setStatus(`Complete: ${success} succeeded, ${failed} failed`)
    setRunning(false)
  }

  return (
    <div>
      <div className="flex gap-3 mb-6">
        <button
          onClick={run}
          disabled={running}
          className="px-5 py-2.5 bg-orange-600 text-white text-sm font-bold rounded-xl hover:bg-orange-500 transition-colors disabled:opacity-50"
        >
          {running ? 'Running...' : 'Start backfill'}
        </button>
        {running && (
          <button
            onClick={() => { abortRef.current = true }}
            className="px-5 py-2.5 bg-zinc-800 text-white text-sm font-bold rounded-xl hover:bg-zinc-700 transition-colors"
          >
            Stop
          </button>
        )}
      </div>

      {status && (
        <p className="text-sm text-orange-400 mb-4">{status}</p>
      )}

      {log.length > 0 && (
        <div className="bg-zinc-900 rounded-xl p-4 max-h-96 overflow-y-auto border border-zinc-800">
          {log.map((line, i) => (
            <p key={i} className="text-xs text-zinc-400 font-mono leading-relaxed">{line}</p>
          ))}
        </div>
      )}
    </div>
  )
}
