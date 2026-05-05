import lamejs from 'lamejs'

const PREVIEW_DURATION = 30
const FADE_DURATION = 2
const BITRATE = 128
const OUTPUT_SAMPLE_RATE = 44100

export async function generatePreviewBlob(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer()
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()

  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer)
    const sampleRate = decoded.sampleRate
    const channels = Math.min(decoded.numberOfChannels, 2)
    const previewSamples = Math.min(
      Math.floor(PREVIEW_DURATION * sampleRate),
      decoded.length,
    )
    const fadeStartSample = Math.max(0, previewSamples - Math.floor(FADE_DURATION * sampleRate))

    const left = decoded.getChannelData(0).slice(0, previewSamples)
    const right = channels === 2
      ? decoded.getChannelData(1).slice(0, previewSamples)
      : left

    applyFadeOut(left, fadeStartSample)
    if (channels === 2) applyFadeOut(right, fadeStartSample)

    const leftResampled = resample(left, sampleRate, OUTPUT_SAMPLE_RATE)
    const rightResampled = channels === 2
      ? resample(right, sampleRate, OUTPUT_SAMPLE_RATE)
      : leftResampled

    const leftInt = floatToInt16(leftResampled)
    const rightInt = floatToInt16(rightResampled)

    const encoder = new lamejs.Mp3Encoder(channels, OUTPUT_SAMPLE_RATE, BITRATE)
    const mp3Parts: Int8Array[] = []
    const blockSize = 1152

    for (let i = 0; i < leftInt.length; i += blockSize) {
      const leftChunk = leftInt.subarray(i, i + blockSize)
      const rightChunk = rightInt.subarray(i, i + blockSize)
      const mp3buf = channels === 2
        ? encoder.encodeBuffer(leftChunk, rightChunk)
        : encoder.encodeBuffer(leftChunk)
      if (mp3buf.length > 0) mp3Parts.push(mp3buf)
    }

    const flush = encoder.flush()
    if (flush.length > 0) mp3Parts.push(flush)

    return new Blob(mp3Parts, { type: 'audio/mpeg' })
  } finally {
    await audioCtx.close()
  }
}

function applyFadeOut(samples: Float32Array, fadeStart: number) {
  const fadeLength = samples.length - fadeStart
  for (let i = fadeStart; i < samples.length; i++) {
    samples[i] *= 1 - (i - fadeStart) / fadeLength
  }
}

function floatToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return int16
}

function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input
  const ratio = fromRate / toRate
  const outputLength = Math.floor(input.length / ratio)
  const output = new Float32Array(outputLength)
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio
    const low = Math.floor(srcIndex)
    const high = Math.min(low + 1, input.length - 1)
    const frac = srcIndex - low
    output[i] = input[low] * (1 - frac) + input[high] * frac
  }
  return output
}
