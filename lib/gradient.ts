// Deterministic gradient generation — shared between client preview and Edge Function.
// Given an artist_id + release_id, always produces the same gradient.

function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 16), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 16), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function hslToHex(h: number, s: number, l: number): string {
  const hDecimal = l / 100
  const a = (s * Math.min(hDecimal, 1 - hDecimal)) / 100
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const colour = hDecimal - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * colour).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

export interface GradientResult {
  colours: string[]
  angle: number
  css: string
  svg: string
}

export function generateGradient(artistId: string, releaseId: string): GradientResult {
  const hash = cyrb53(`${artistId}:${releaseId}`)
  const rand = seededRandom(hash)

  const hue1 = Math.floor(rand() * 360)
  const hueOffset = 40 + Math.floor(rand() * 80)
  const hue2 = (hue1 + hueOffset) % 360

  const sat1 = 60 + Math.floor(rand() * 30)
  const sat2 = 60 + Math.floor(rand() * 30)
  const lit1 = 35 + Math.floor(rand() * 20)
  const lit2 = 35 + Math.floor(rand() * 20)

  const colour1 = hslToHex(hue1, sat1, lit1)
  const colour2 = hslToHex(hue2, sat2, lit2)

  const useThreeStops = rand() < 0.4
  const colours = [colour1, colour2]

  if (useThreeStops) {
    const hue3 = (hue1 + hueOffset * 2) % 360
    const sat3 = 60 + Math.floor(rand() * 30)
    const lit3 = 35 + Math.floor(rand() * 20)
    colours.push(hslToHex(hue3, sat3, lit3))
  }

  const angles = [0, 45, 90, 135, 180, 225, 270, 315]
  const angle = angles[Math.floor(rand() * angles.length)]

  // CSS gradient
  const css = `linear-gradient(${angle}deg, ${colours.join(', ')})`

  // SVG
  const size = 1200
  const rad = (angle * Math.PI) / 180
  const x1 = Math.round((50 - 50 * Math.cos(rad)) * 100) / 100
  const y1 = Math.round((50 - 50 * Math.sin(rad)) * 100) / 100
  const x2 = Math.round((50 + 50 * Math.cos(rad)) * 100) / 100
  const y2 = Math.round((50 + 50 * Math.sin(rad)) * 100) / 100

  const stops = colours
    .map((c, i) => {
      const offset = colours.length === 2 ? (i === 0 ? '0' : '100') : `${i * 50}`
      return `<stop offset="${offset}%" stop-color="${c}"/>`
    })
    .join('\n      ')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">
      ${stops}
    </linearGradient>
    <filter id="noise">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <rect width="${size}" height="${size}" filter="url(#noise)" opacity="0.05"/>
</svg>`

  return { colours, angle, css, svg }
}

/** Generate a data URI for use as an <img> src */
export function generateGradientDataUri(artistId: string, releaseId: string): string {
  const { svg } = generateGradient(artistId, releaseId)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
