'use client'

export const runtime = 'edge'

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#ea580c', marginBottom: '1rem' }}>Error</p>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 900, marginBottom: '0.75rem' }}>Something went wrong.</h1>
            <button
              onClick={reset}
              style={{ background: '#ea580c', color: '#000', fontWeight: 900, padding: '0.75rem 1.5rem', borderRadius: '0.75rem', fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
