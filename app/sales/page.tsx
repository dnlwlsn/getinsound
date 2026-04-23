import { SalesClient } from './SalesClient'

export const runtime = 'edge'
export const metadata = { title: 'Sales & Payouts | Insound' }

export default function SalesPage() {
  return <SalesClient />
}
