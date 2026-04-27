import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import { cookies } from 'next/headers'
import { PlayerBar } from './components/PlayerBar'
import { AppNav } from './components/ui/AppNav'
import { CurrencyProvider } from './providers/CurrencyProvider'
import { ServiceWorkerRegistration } from './components/pwa/ServiceWorkerRegistration'
import { InstallBanner } from './components/pwa/InstallBanner'
import { CookieBanner } from './components/ui/CookieBanner'
import { GenreOnboarding } from './components/GenreOnboarding'
import './globals.css'


const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-montserrat',
})

export const metadata: Metadata = {
  title: 'insound. — Music That Pays Artists',
  description: 'The music platform that only takes 10%. Stripe processing shown transparently at checkout. No labels, no middlemen.',
  openGraph: {
    title: 'Insound — Music That Pays Artists',
    description: 'Upload your music. We only take 10%. Stripe processing shown at checkout. Own your masters. No monthly fee.',
    url: 'https://getinsound.com',
    siteName: 'Insound',
    type: 'website',
    images: [{ url: 'https://getinsound.com/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Insound — Music That Pays Artists',
    description: 'Upload your music. We only take 10%. Stripe processing shown at checkout. Own your masters. No monthly fee.',
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
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-orange-600 focus:text-black focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-bold">Skip to content</a>
        <CurrencyProvider initialLocale={initialLocale} initialCurrency={initialCurrency}>
          <AppNav />
          <main id="main-content">{children}</main>
        </CurrencyProvider>
        <GenreOnboarding redirectTo="/discover" />
        <PlayerBar />
        <ServiceWorkerRegistration />
        <InstallBanner />
        <CookieBanner />
      </body>
    </html>
  )
}
