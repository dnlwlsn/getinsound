import type { Metadata } from 'next'
import AuthClient from './AuthClient'

export const metadata: Metadata = {
  title: 'Sign In | Insound',
  description:
    'Sign in or create your free Insound account. Join 12,400+ independent artists. We take 10%, Stripe takes 1.5% + 20p, you keep the rest.',
  openGraph: {
    title: 'Sign In | Insound',
    description:
      'Sign in or create your free Insound account. Join 12,400+ independent artists. We take 10%, Stripe takes 1.5% + 20p, you keep the rest.',
    type: 'website',
  },
}

export default function AuthPage() {
  return <AuthClient />
}
