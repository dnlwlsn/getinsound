'use client'


export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#F56D00', marginBottom: '1rem' }}>Error</p>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 900, marginBottom: '0.75rem' }}>We hit an unexpected error.</h1>
            <p style={{ fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '1.5rem' }}>Try refreshing the page, or come back in a moment.</p>
            <button
              onClick={reset}
              style={{ background: '#F56D00', color: '#000', fontWeight: 900, padding: '0.75rem 1.5rem', borderRadius: '0.75rem', fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}
            >
              Try Again
            </button>
            <a href="/" style={{ display: 'block', marginTop: '1rem', fontSize: '0.875rem', color: '#a1a1aa', textDecoration: 'none' }}>Go home</a>
          </div>
        </div>
      </body>
    </html>
  )
}
