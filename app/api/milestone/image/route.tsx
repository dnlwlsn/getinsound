import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'


export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')
  if (!name) return new Response('Missing name', { status: 400 })

  const bars = [
    { x: 0, h: 42 },
    { x: 25, h: 65 },
    { x: 50, h: 88 },
    { x: 75, h: 69 },
    { x: 100, h: 97 },
    { x: 125, h: 65 },
    { x: 150, h: 19 },
  ]

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#0A0A0A',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle radial glow */}
        <div
          style={{
            position: 'absolute',
            top: -100,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 800,
            height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,109,0,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Waveform logo */}
        <svg
          width="154"
          height="96"
          viewBox="0 0 193 120"
          style={{ marginBottom: 40 }}
        >
          {bars.map((bar) => (
            <rect
              key={bar.x}
              x={bar.x}
              y={60 - bar.h / 2}
              width="18"
              height={bar.h}
              rx="3"
              ry="3"
              fill="#F56D00"
            />
          ))}
        </svg>

        {/* Artist name */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: '#FAFAFA',
            letterSpacing: -2,
            marginBottom: 16,
            textAlign: 'center',
            maxWidth: 900,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </div>

        {/* Milestone text */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#F56D00',
            letterSpacing: 4,
            textTransform: 'uppercase',
          }}
        >
          First sale on Insound
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            fontSize: 14,
            fontWeight: 600,
            color: '#3f3f46',
          }}
        >
          getinsound.com
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
