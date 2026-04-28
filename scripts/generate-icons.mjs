import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

function createWaveformSvg(size, padding = 0) {
  const bars = [
    { x: 0, y: 39.168, w: 18, h: 41.664 },
    { x: 25, y: 27.648, w: 18, h: 64.704 },
    { x: 50, y: 16.128, w: 18, h: 87.744 },
    { x: 75, y: 25.344, w: 18, h: 69.312 },
    { x: 100, y: 11.52, w: 18, h: 96.96 },
    { x: 125, y: 27.648, w: 18, h: 64.704 },
  ]

  const srcW = 143
  const srcH = 120
  const drawArea = size - padding * 2
  const scale = drawArea / Math.max(srcW, srcH)
  const offsetX = padding + (drawArea - srcW * scale) / 2
  const offsetY = padding + (drawArea - srcH * scale) / 2

  const rects = bars
    .map(
      (b) =>
        `<rect x="${offsetX + b.x * scale}" y="${offsetY + b.y * scale}" width="${b.w * scale}" height="${b.h * scale}" rx="${3 * scale}" ry="${3 * scale}" fill="#F47429"/>`
    )
    .join('\n  ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0A0A0A"/>
  ${rects}
</svg>`
}

const configs = [
  { name: 'icon-192.png', size: 192, padding: 20 },
  { name: 'icon-512.png', size: 512, padding: 50 },
  { name: 'icon-192-maskable.png', size: 192, padding: 192 * 0.2 },
  { name: 'icon-512-maskable.png', size: 512, padding: 512 * 0.2 },
  { name: 'apple-touch-icon.png', size: 180, padding: 18 },
]

for (const { name, size, padding } of configs) {
  const svg = createWaveformSvg(size, padding)
  await sharp(Buffer.from(svg)).png().toFile(join(outDir, name))
  console.log(`Generated ${name}`)
}
