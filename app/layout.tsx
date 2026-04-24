import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import { cookies } from 'next/headers'
import { PlayerBar } from './components/PlayerBar'
import { AppNav } from './components/ui/AppNav'
import { CurrencyProvider } from './providers/CurrencyProvider'
import './globals.css'

export const runtime = 'edge'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-montserrat',
})

export const metadata: Metadata = {
  title: 'insound. — Music That Pays Artists',
  description: 'The music platform that only takes 10%. Stripe processing shown transparently at checkout. No labels, no middlemen. Join the waitlist.',
  openGraph: {
    title: 'Insound — Music That Pays Artists',
    description: 'Upload your music. We only take 10%. Stripe processing shown at checkout. Own your masters. No monthly fee. Join the waitlist.',
    url: 'https://getinsound.com',
    siteName: 'Insound',
    type: 'website',
    images: [{ url: 'https://getinsound.com/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Insound — Music That Pays Artists',
    description: 'Upload your music. We only take 10%. Stripe processing shown at checkout. Own your masters. No monthly fee. Join the waitlist.',
    images: ['https://getinsound.com/og-image.png'],
  },
  icons: { icon: '/favicon.svg' },
  alternates: { canonical: 'https://getinsound.com/' },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const initialLocale = cookieStore.get('insound_locale')?.value || ''
  const initialCurrency = cookieStore.get('insound_currency')?.value || 'GBP'

  return (
    <html lang="en" className={`dark ${montserrat.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#F56D00" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body>
        <CurrencyProvider initialLocale={initialLocale} initialCurrency={initialCurrency}>
          <AppNav />
          {children}
        </CurrencyProvider>
        <PlayerBar />
      </body>
    </html>
  )
}
