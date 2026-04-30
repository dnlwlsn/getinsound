'use client'

import Link from 'next/link'
import Image from 'next/image'
import { formatPrice } from '@/app/lib/currency'
import { getTrackingUrl } from '@/lib/carriers'
import { Footer } from '@/app/components/ui/Footer'

interface OrderItem {
  id: string
  merch_id: string
  fan_id: string
  artist_id: string
  amount_paid: number
  amount_paid_currency: string
  status: string
  carrier: string | null
  tracking_number: string | null
  created_at: string
  dispatched_at: string | null
  delivered_at: string | null
  return_requested_at: string | null
  returned_at: string | null
  variant_selected: string | null
  postage_paid: number
  shipping_address: unknown
  merch: { name: string; photos: string[] } | null
  artists: { name: string; slug: string; accent_colour: string | null } | null
}

interface Props {
  orders: OrderItem[]
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-zinc-800 text-zinc-400',
  paid: 'bg-yellow-900/50 text-yellow-400',
  dispatched: 'bg-blue-900/50 text-blue-400',
  delivered: 'bg-green-900/50 text-green-400',
  return_requested: 'bg-yellow-900/50 text-yellow-400',
  returned: 'bg-red-900/50 text-red-400',
  refunded: 'bg-red-900/50 text-red-400',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function OrdersClient({ orders }: Props) {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-32">
        <h1 className="text-2xl font-black uppercase tracking-wider mb-8">Orders</h1>

        {orders.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-500 text-sm mb-4">No orders yet</p>
            <Link
              href="/explore"
              className="inline-block bg-white text-black font-black text-xs uppercase tracking-wider px-6 py-3 rounded-full hover:bg-zinc-200 transition-colors"
            >
              Explore merch
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const merch = Array.isArray(order.merch) ? order.merch[0] : order.merch
              const artist = Array.isArray(order.artists) ? order.artists[0] : order.artists
              const photo = merch?.photos?.[0]
              const trackingUrl = getTrackingUrl(order.carrier, order.tracking_number)

              return (
                <div key={order.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-start gap-4">
                  <div className="relative w-16 h-16 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                    {photo ? (
                      <Image src={photo} fill className="object-cover" sizes="64px" alt={merch?.name || 'Merch item'} />
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">
                      {merch?.name || 'Unknown item'}
                      {order.variant_selected ? ` (${order.variant_selected})` : ''}
                    </p>

                    {artist && (
                      <Link
                        href={`/${artist.slug}`}
                        className="text-[10px] font-bold hover:text-orange-500 transition-colors"
                        style={{ color: artist.accent_colour || '#a1a1aa' }}
                      >
                        {artist.name}
                      </Link>
                    )}

                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {formatPrice(order.amount_paid / 100, order.amount_paid_currency)} · {formatDate(order.created_at)}
                    </p>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[order.status] || 'bg-zinc-800 text-zinc-500'}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>

                      {trackingUrl && (
                        <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-400 hover:text-blue-300">
                          Track parcel
                        </a>
                      )}
                    </div>

                    {order.dispatched_at && (
                      <p className="text-[10px] text-zinc-600 mt-1.5">
                        Dispatched {formatDate(order.dispatched_at)}
                      </p>
                    )}

                    {order.delivered_at && (
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        Delivered {formatDate(order.delivered_at)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <Footer />
    </main>
  )
}
