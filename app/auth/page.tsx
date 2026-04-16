import type { Metadata } from 'next'
import AuthClient from './AuthClient'

export const metadata: Metadata = {
  title: 'Sign In | Insound',
  description:
    'Sign in or create your free Insound account. Join 12,400+ independent artists earning 90% from every sale.',
  openGraph: {
    title: 'Sign In | Insound',
    description:
      'Sign in or create your free Insound account. Join 12,400+ independent artists earning 90% from every sale.',
    type: 'website',
  },
}

export default function AuthPage() {
  return <AuthClient />
}
