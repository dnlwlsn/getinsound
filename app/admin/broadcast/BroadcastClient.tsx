'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Template {
  id: string
  name: string
  subject: string
  body_markdown: string
  updated_at: string
}

interface HistoryEntry {
  id: string
  subject: string
  audience_filter: { audience: string }
  recipient_count: number
  status: string
  created_at: string
}

type Tab = 'compose' | 'templates' | 'history'
type Step = 'edit' | 'preview' | 'confirm'

const AUDIENCES = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'artists', label: 'Artists' },
  { value: 'fans', label: 'Fans' },
  { value: 'purchasers', label: 'Purchasers' },
] as const

export default function BroadcastClient({ adminEmail }: { adminEmail: string }) {
  const [tab, setTab] = useState<Tab>('compose')

  // Compose state
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState('everyone')
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(false)
  const [step, setStep] = useState<Step>('edit')

  // Send state
  const [sending, setSending] = useState(false)
  const [testSending, setTestSending] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Templates state
  const [templates, setTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  // History state
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const fetchAudienceCount = useCallback(async (aud: string) => {
    setLoadingCount(true)
    try {
      const res = await fetch('/api/admin/broadcast/audience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audience: aud }),
      })
      const data = await res.json()
      setAudienceCount(data.count ?? 0)
    } catch {
      setAudienceCount(null)
    }
    setLoadingCount(false)
  }, [])

  useEffect(() => {
    fetchAudienceCount(audience)
  }, [audience, fetchAudienceCount])

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true)
    try {
      const res = await fetch('/api/admin/broadcast/templates')
      const data = await res.json()
      if (Array.isArray(data)) setTemplates(data)
    } catch { /* ignore */ }
    setLoadingTemplates(false)
  }, [])

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/admin/broadcast/history')
      const data = await res.json()
      if (Array.isArray(data)) setHistory(data)
    } catch { /* ignore */ }
    setLoadingHistory(false)
  }, [])

  useEffect(() => {
    if (tab === 'templates') fetchTemplates()
    if (tab === 'history') fetchHistory()
  }, [tab, fetchTemplates, fetchHistory])

  const handleTestSend = async () => {
    if (!subject || !body) return
    setTestSending(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/broadcast/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body_markdown: body }),
      })
      const data = await res.json()
      if (data.ok) {
        setMessage({ type: 'success', text: `Test email sent to ${data.sent_to}` })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send test' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' })
    }
    setTestSending(false)
  }

  const handleSend = async () => {
    if (!subject || !body) return
    setSending(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/broadcast/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body_markdown: body, audience }),
      })
      const data = await res.json()
      if (data.ok) {
        setMessage({
          type: 'success',
          text: `Broadcast sent to ${data.sent} recipients${data.failed ? ` (${data.failed} failed)` : ''}`,
        })
        setStep('edit')
        setSubject('')
        setBody('')
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' })
    }
    setSending(false)
  }

  const handleSaveTemplate = async () => {
    if (!templateName || !subject || !body) return
    setSavingTemplate(true)
    try {
      const method = editingTemplate ? 'PUT' : 'POST'
      const payload = editingTemplate
        ? { id: editingTemplate.id, name: templateName, subject, body_markdown: body }
        : { name: templateName, subject, body_markdown: body }

      const res = await fetch('/api/admin/broadcast/templates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setMessage({ type: 'success', text: editingTemplate ? 'Template updated' : 'Template saved' })
        setTemplateName('')
        setEditingTemplate(null)
        fetchTemplates()
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save template' })
    }
    setSavingTemplate(false)
  }

  const handleDeleteTemplate = async (id: string) => {
    try {
      await fetch('/api/admin/broadcast/templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch { /* ignore */ }
  }

  const loadTemplate = (t: Template) => {
    setSubject(t.subject)
    setBody(t.body_markdown)
    setTab('compose')
    setStep('edit')
    setMessage({ type: 'success', text: `Loaded template "${t.name}"` })
  }

  const simpleMarkdownPreview = (md: string) => {
    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const escaped = escapeHtml(md)
    return escaped
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-4 mb-1">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-4 mb-1">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-1">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" class="text-orange-500 underline">$1</a>')
      .replace(/\n\n/g, '</p><p class="mb-3">')
      .replace(/\n/g, '<br>')
  }

  return (
    <div className="min-h-screen font-display">
      <nav
        className="sticky top-0 w-full z-50 flex justify-between items-center px-5 md:px-10 py-4"
        style={{
          background: 'rgba(9,9,11,0.88)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(39,39,42,0.8)',
        }}
      >
        <Link href="/" className="text-xl font-black text-orange-600 tracking-tighter">
          insound.
        </Link>
        <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Admin &mdash; Broadcast</span>
      </nav>

      <main className="max-w-3xl mx-auto px-5 py-12">
        <h1 className="text-3xl font-black tracking-tight mb-2">Email Broadcast</h1>
        <p className="text-zinc-500 text-sm mb-8">Compose and send emails to your community.</p>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-zinc-900/50 border border-zinc-800 rounded-xl p-1">
          {(['compose', 'templates', 'history'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setMessage(null) }}
              className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-colors ${
                tab === t
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {message && (
          <div className={`text-sm font-bold px-4 py-3 rounded-xl mb-6 ${
            message.type === 'success'
              ? 'bg-green-900/30 text-green-400 border border-green-800/50'
              : 'bg-red-900/30 text-red-400 border border-red-800/50'
          }`}>
            {message.text}
          </div>
        )}

        {/* COMPOSE TAB */}
        {tab === 'compose' && step === 'edit' && (
          <div className="space-y-5">
            {/* Audience Selector */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                Audience
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {AUDIENCES.map(a => (
                  <button
                    key={a.value}
                    onClick={() => setAudience(a.value)}
                    className={`py-3 px-3 rounded-xl text-xs font-bold border transition-colors ${
                      audience === a.value
                        ? 'bg-orange-600/10 border-orange-600 text-orange-500'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-600 mt-2">
                {loadingCount ? 'Counting...' : audienceCount !== null ? `${audienceCount.toLocaleString()} recipient${audienceCount !== 1 ? 's' : ''}` : ''}
              </p>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Your email subject line..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-orange-600 transition-colors placeholder-zinc-600"
              />
            </div>

            {/* Body Editor */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                Body <span className="text-zinc-700 normal-case">(Markdown supported)</span>
              </label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={14}
                placeholder="Write your email content here...&#10;&#10;Supports **bold**, *italic*, [links](url), and headings (#, ##, ###)"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-orange-600 transition-colors placeholder-zinc-600 resize-none font-mono"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => { setStep('preview'); setMessage(null) }}
                disabled={!subject || !body}
                className="flex-1 bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider disabled:opacity-50"
              >
                Preview
              </button>
              <button
                onClick={handleTestSend}
                disabled={!subject || !body || testSending}
                className="px-6 bg-zinc-800 text-white font-black py-4 rounded-xl hover:bg-zinc-700 transition-colors text-sm uppercase tracking-wider disabled:opacity-50"
              >
                {testSending ? 'Sending...' : 'Test Send'}
              </button>
            </div>

            {/* Save as Template */}
            <div className="flex gap-2 pt-2">
              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="Template name..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-orange-600 transition-colors placeholder-zinc-600"
              />
              <button
                onClick={handleSaveTemplate}
                disabled={!templateName || !subject || !body || savingTemplate}
                className="px-5 bg-zinc-800 text-zinc-300 font-bold py-2.5 rounded-xl hover:bg-zinc-700 transition-colors text-xs uppercase tracking-wider disabled:opacity-50"
              >
                {savingTemplate ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        )}

        {/* PREVIEW STEP */}
        {tab === 'compose' && step === 'preview' && (
          <div className="space-y-5">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Preview</span>
                <span className="text-xs text-zinc-600">
                  To: {AUDIENCES.find(a => a.value === audience)?.label} ({audienceCount?.toLocaleString() ?? '?'})
                </span>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs text-zinc-500 mb-1">Subject</p>
                <p className="font-bold text-white mb-4">{subject}</p>
                <div className="border-t border-zinc-800 pt-4">
                  <div
                    className="text-sm text-zinc-300 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: simpleMarkdownPreview(body) }}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('edit')}
                className="px-6 bg-zinc-800 text-white font-black py-4 rounded-xl hover:bg-zinc-700 transition-colors text-sm uppercase tracking-wider"
              >
                &larr; Edit
              </button>
              <button
                onClick={() => { setStep('confirm'); setMessage(null) }}
                className="flex-1 bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider"
              >
                Send to {audienceCount?.toLocaleString() ?? '?'} recipients
              </button>
            </div>
          </div>
        )}

        {/* CONFIRMATION STEP */}
        {tab === 'compose' && step === 'confirm' && (
          <div className="space-y-5">
            <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-6 text-center">
              <p className="text-lg font-black text-red-400 mb-2">Confirm Broadcast</p>
              <p className="text-sm text-zinc-400 mb-1">
                You are about to send <strong className="text-white">&ldquo;{subject}&rdquo;</strong>
              </p>
              <p className="text-sm text-zinc-400">
                to <strong className="text-white">{audienceCount?.toLocaleString() ?? '?'} {AUDIENCES.find(a => a.value === audience)?.label?.toLowerCase()}</strong>
              </p>
              <p className="text-xs text-red-400/60 mt-3">This action cannot be undone.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('preview')}
                disabled={sending}
                className="px-6 bg-zinc-800 text-white font-black py-4 rounded-xl hover:bg-zinc-700 transition-colors text-sm uppercase tracking-wider disabled:opacity-50"
              >
                &larr; Back
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 bg-red-600 text-white font-black py-4 rounded-xl hover:bg-red-500 transition-colors text-sm uppercase tracking-wider disabled:opacity-50"
              >
                {sending ? 'Sending...' : `Yes, send to ${audienceCount?.toLocaleString() ?? '?'} recipients`}
              </button>
            </div>
          </div>
        )}

        {/* TEMPLATES TAB */}
        {tab === 'templates' && (
          <div>
            {loadingTemplates ? (
              <p className="text-zinc-600 text-sm">Loading templates...</p>
            ) : templates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-zinc-500 text-sm mb-2">No templates yet.</p>
                <p className="text-zinc-600 text-xs">Save one from the compose tab.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map(t => (
                  <div
                    key={t.id}
                    className="bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-sm text-white">{t.name}</p>
                      <span className="text-xs text-zinc-600">
                        {new Date(t.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 truncate mb-3">{t.subject}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadTemplate(t)}
                        className="text-xs font-bold text-orange-500 hover:text-orange-400 transition-colors"
                      >
                        Use
                      </button>
                      <button
                        onClick={() => {
                          setEditingTemplate(t)
                          setSubject(t.subject)
                          setBody(t.body_markdown)
                          setTemplateName(t.name)
                          setTab('compose')
                        }}
                        className="text-xs font-bold text-zinc-400 hover:text-zinc-300 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(t.id)}
                        className="text-xs font-bold text-zinc-600 hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div>
            {loadingHistory ? (
              <p className="text-zinc-600 text-sm">Loading history...</p>
            ) : history.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-zinc-500 text-sm">No broadcasts sent yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map(h => (
                  <div
                    key={h.id}
                    className="bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-sm text-white">{h.subject}</p>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                        h.status === 'sent'
                          ? 'bg-green-900/30 text-green-500'
                          : h.status === 'sending'
                            ? 'bg-yellow-900/30 text-yellow-500'
                            : 'bg-red-900/30 text-red-500'
                      }`}>
                        {h.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span>{h.audience_filter?.audience ?? 'unknown'}</span>
                      <span>&middot;</span>
                      <span>{h.recipient_count.toLocaleString()} recipients</span>
                      <span>&middot;</span>
                      <span>{new Date(h.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
