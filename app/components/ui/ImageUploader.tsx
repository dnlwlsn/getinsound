'use client'

import { useState, useRef, useCallback } from 'react'
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface ImageUploaderProps {
  currentUrl: string | null
  onUpload: (file: File) => Promise<void>
  onRemove?: () => void
  aspect: number
  maxSizeMB: number
  accept?: string
  label: string
  recommendedSize?: string
  variant: 'avatar' | 'banner'
  fallback: React.ReactNode
  accent?: string
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  )
}

async function getCroppedBlob(image: HTMLImageElement, crop: PixelCrop, mimeType: string): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  canvas.width = crop.width * scaleX
  canvas.height = crop.height * scaleY
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    image,
    crop.x * scaleX, crop.y * scaleY,
    crop.width * scaleX, crop.height * scaleY,
    0, 0,
    canvas.width, canvas.height,
  )
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas export failed')), mimeType, 0.92)
  })
}

export function ImageUploader({
  currentUrl, onUpload, onRemove, aspect, maxSizeMB,
  accept = 'image/jpeg,image/png,image/webp,image/gif',
  label, recommendedSize, variant, fallback, accent = '#F56D00',
}: ImageUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null!)
  const [dragOver, setDragOver] = useState(false)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [previewMime, setPreviewMime] = useState('image/jpeg')
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const acceptExts = accept.split(',').map(t => t.split('/')[1]).join(', ')

  const handleFile = useCallback((file: File) => {
    setError('')
    if (!accept.split(',').some(t => file.type === t.trim())) {
      setError(`Accepted formats: ${acceptExts}`)
      return
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File must be under ${maxSizeMB}MB`)
      return
    }
    setPreviewMime(file.type)
    const reader = new FileReader()
    reader.onload = () => setPreviewSrc(reader.result as string)
    reader.readAsDataURL(file)
  }, [accept, acceptExts, maxSizeMB])

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget
    setCrop(centerAspectCrop(w, h, aspect))
  }

  async function handleConfirmCrop() {
    if (!imgRef.current || !completedCrop) return
    setUploading(true)
    setError('')
    try {
      const blob = await getCroppedBlob(imgRef.current, completedCrop, previewMime)
      const ext = previewMime.split('/')[1] === 'jpeg' ? 'jpg' : previewMime.split('/')[1]
      const file = new File([blob], `upload.${ext}`, { type: previewMime })
      await onUpload(file)
      setPreviewSrc(null)
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    }
    setUploading(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  if (variant === 'avatar') {
    return (
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-3">{label}</label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            aria-label="Upload avatar"
            className={`w-20 h-20 rounded-full overflow-hidden shrink-0 relative group transition-all ${dragOver ? 'ring-2 ring-offset-2 ring-offset-zinc-900' : ''}`}
          >
            {currentUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : fallback}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <svg width="20" height="20" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </div>
          </button>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-sm font-bold px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            {currentUrl && onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="block text-xs text-zinc-500 hover:text-red-400 transition-colors font-bold"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>
        <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={handleInputChange} />
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        {previewSrc && <CropModal src={previewSrc} aspect={aspect} imgRef={imgRef} crop={crop} setCrop={setCrop} completedCrop={completedCrop} setCompletedCrop={setCompletedCrop} onImageLoad={onImageLoad} onConfirm={handleConfirmCrop} onCancel={() => setPreviewSrc(null)} uploading={uploading} accent={accent} />}
      </div>
    )
  }

  // Banner variant
  return (
    <div>
      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-3">{label}</label>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        aria-label="Upload banner image"
        className={`w-full aspect-[3/1] rounded-2xl overflow-hidden relative group transition-all border border-zinc-800 ${dragOver ? 'ring-2 ring-offset-2 ring-offset-zinc-900' : ''}`}
      >
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="Banner" className="w-full h-full object-cover" />
        ) : fallback}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
          <svg width="24" height="24" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
          <span className="text-xs font-bold text-white">Upload banner</span>
        </div>
      </button>
      {recommendedSize && <p className="text-[10px] text-zinc-600 mt-1.5">{recommendedSize}</p>}
      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="text-sm font-bold px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload banner'}
        </button>
        {currentUrl && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-zinc-500 hover:text-red-400 transition-colors font-bold px-4 py-2"
          >
            Remove
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={handleInputChange} />
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      {previewSrc && <CropModal src={previewSrc} aspect={aspect} imgRef={imgRef} crop={crop} setCrop={setCrop} completedCrop={completedCrop} setCompletedCrop={setCompletedCrop} onImageLoad={onImageLoad} onConfirm={handleConfirmCrop} onCancel={() => setPreviewSrc(null)} uploading={uploading} accent={accent} />}
    </div>
  )
}

function CropModal({ src, aspect, imgRef, crop, setCrop, completedCrop, setCompletedCrop, onImageLoad, onConfirm, onCancel, uploading, accent }: {
  src: string; aspect: number; imgRef: React.RefObject<HTMLImageElement>
  crop: Crop | undefined; setCrop: (c: Crop) => void
  completedCrop: PixelCrop | undefined; setCompletedCrop: (c: PixelCrop) => void
  onImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void
  onConfirm: () => void; onCancel: () => void; uploading: boolean; accent: string
}) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-display font-bold text-lg">Crop image</h3>
        <div className="max-h-[60vh] overflow-auto flex items-center justify-center bg-black rounded-xl">
          <ReactCrop
            crop={crop}
            onChange={c => setCrop(c)}
            onComplete={c => setCompletedCrop(c)}
            aspect={aspect}
            circularCrop={aspect === 1}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt="Crop preview"
              onLoad={onImageLoad}
              style={{ maxHeight: '60vh' }}
            />
          </ReactCrop>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
            className="flex-1 text-zinc-400 font-bold text-sm py-3 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={uploading || !completedCrop}
            className="flex-1 font-bold text-sm py-3 rounded-xl transition-colors disabled:opacity-50"
            style={{ background: accent, color: '#000' }}
          >
            {uploading ? 'Uploading...' : 'Confirm & Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}
