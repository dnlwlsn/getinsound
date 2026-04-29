const cache = new Map<string, string>()

export function extractDominantColor(imageUrl: string): Promise<string> {
  const cached = cache.get(imageUrl)
  if (cached) return Promise.resolve(cached)

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const size = 10
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, size, size)

      const data = ctx.getImageData(0, 0, size, size).data
      let r = 0, g = 0, b = 0, count = 0

      for (let i = 0; i < data.length; i += 4) {
        const pr = data[i], pg = data[i + 1], pb = data[i + 2]
        const brightness = (pr + pg + pb) / 3
        if (brightness < 20 || brightness > 235) continue
        r += pr
        g += pg
        b += pb
        count++
      }

      if (count === 0) {
        resolve('#F56D00')
        return
      }

      r = Math.round(r / count)
      g = Math.round(g / count)
      b = Math.round(b / count)

      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      const l = (max + min) / 2 / 255
      if (l < 0.15) {
        r = Math.min(255, r + 60)
        g = Math.min(255, g + 60)
        b = Math.min(255, b + 60)
      }

      const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
      cache.set(imageUrl, hex)
      resolve(hex)
    }
    img.onerror = () => resolve('#F56D00')
    img.src = imageUrl
  })
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
