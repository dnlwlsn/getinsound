import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import '@/app/globals.css'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-montserrat',
})

export const metadata: Metadata = {
  robots: 'noindex',
}

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${montserrat.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="bg-insound-bg text-white m-0 p-0 overflow-hidden">
        {children}
      </body>
    </html>
  )
}
