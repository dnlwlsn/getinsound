import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-montserrat',
})

// Injected before paint to prevent theme flash
const themeScript = `(function(){var s=localStorage.getItem('insound_theme')||(window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark');if(s==='light')document.documentElement.setAttribute('data-theme','light');})();`

export const metadata: Metadata = {
  title: 'insound. — Music That Pays Artists',
  description: 'The music platform where artists keep 90% of every sale. No labels, no middlemen. Join the waitlist.',
  openGraph: {
    title: 'Insound — Music That Pays Artists',
    description: 'Upload your music. Keep 90%. Own your masters. No monthly fee. Join the waitlist.',
    url: 'https://getinsound.com',
    siteName: 'Insound',
    type: 'website',
    images: [{ url: 'https://getinsound.com/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Insound — Music That Pays Artists',
    description: 'Upload your music. Keep 90%. Own your masters. No monthly fee. Join the waitlist.',
    images: ['https://getinsound.com/og-image.png'],
  },
  icons: { icon: '/favicon.svg' },
  alternates: { canonical: 'https://getinsound.com/' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={montserrat.variable} suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
