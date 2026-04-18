import type { Metadata } from 'next'
import AuthClient from './AuthClient'

export const metadata: Metadata = {
  title: 'Sign In | Insound',
  description:
    'Sign in or create your free Insound account. Join 12,400+ independent artists. We only take 10%. No surprises.',
  openGraph: {
    title: 'Sign In | Insound',
    description:
      'Sign in or create your free Insound account. Join 12,400+ independent artists. We only take 10%. No surprises.',
    type: 'website',
  },
}

export default function AuthPage() {
  return <AuthClient />
}
