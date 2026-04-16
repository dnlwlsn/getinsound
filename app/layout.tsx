import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-montserrat',
})

export const metadata: Metadata = {
  title: 'insound. — Music That Pays Artists',
  description: 'The music platform where artists keep 90% of every sale. No labels, no middlemen.',
  openGraph: {
    title: 'Insound — Music That Pays Artists',
    description: 'Upload your music. Keep 90%. Own your masters. No monthly fee.',
    url: 'https://getinsound.com',
    siteName: 'Insound',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body className="font-sans">
        {children}
      </body>
    </html>
  )
}
