import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const revalidate = 86400

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const title = searchParams.get('title') || 'Insound'
  const artist = searchParams.get('artist') || ''
  const cover = searchParams.get('cover') || ''
  const type = searchParams.get('type') || 'release'

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          backgroundColor: '#09090b',
          padding: '60px',
          alignItems: 'center',
        }}
      >
        {cover && (
          <div
            style={{
              display: 'flex',
              flexShrink: 0,
              marginRight: '60px',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt=""
              width={type === 'artist' ? 340 : 400}
              height={type === 'artist' ? 340 : 400}
              style={{
                borderRadius: type === 'artist' ? '50%' : '24px',
                objectFit: 'cover',
              }}
            />
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: title.length > 30 ? 48 : 64,
              fontWeight: 900,
              color: '#ffffff',
              lineHeight: 1.1,
              marginBottom: artist ? '16px' : '0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
          {artist && (
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: '#F56D00',
                lineHeight: 1.2,
              }}
            >
              {artist}
            </div>
          )}
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '60px',
            fontSize: 24,
            fontWeight: 900,
            color: '#F56D00',
          }}
        >
          insound.
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
