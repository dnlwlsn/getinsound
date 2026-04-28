import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'FAQ | Insound',
  description: 'Frequently asked questions about Insound — buying music, selling as an artist, payments, downloads, and more.',
}

export default function FAQPage() {
  return (
    <main className="bg-zinc-950 text-white min-h-screen">
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-4 mt-4 px-5 py-3 rounded-2xl ring-1 ring-white/[0.05] flex items-center justify-between" style={{ background: 'rgba(5,5,5,0.75)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
          <Link href="/" className="font-display text-lg font-bold">insound<span className="text-orange-500">.</span></Link>
          <Link href="/" className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">&larr; Home</Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 pt-36 pb-24">
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] mb-3">FAQ</h1>
        <p className="text-zinc-500 text-sm mb-16">Everything you need to know about Insound.</p>

        <div className="space-y-12">

          {/* ── For Fans ─────────────────────────────────────── */}
          <section>
            <h2 className="font-display text-[1.35rem] font-bold text-white mb-4">For Fans</h2>
            <div className="space-y-2">
              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  What is Insound?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">A platform where independent artists sell music directly to fans. Artists keep 90% of every sale.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  How do I buy music?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">Find a release, click Buy, pay via Stripe. Your music appears in your Collection.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  What formats can I download?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">WAV, FLAC, and MP3 (320kbps).</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  What is pay-what-you-wish?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">Some releases let you pay above the minimum price. The extra goes directly to the artist.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  Can I stream music?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">You can preview tracks (30 seconds). After purchase, you can stream the full tracks from your Collection.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  What happens if I lose my downloads?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">You can re-download from your Collection within 7 days of purchase. After that, contact us.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  Do I need an account to buy music?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">No. You can buy music with just an email address &mdash; we&rsquo;ll send you a download link straight away. We&rsquo;d recommend creating a free account though: you&rsquo;ll get your own Collection where you can stream everything you&rsquo;ve bought, re-download files, follow artists, and get notified when they release new music.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  How do I get a refund?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">Digital purchases are non-refundable after download. See our <Link href="/terms" className="text-orange-600 hover:text-orange-400">Terms</Link> for exceptions.</p>
              </details>
            </div>
          </section>

          {/* ── For Artists ───────────────────────────────────── */}
          <section>
            <h2 className="font-display text-[1.35rem] font-bold text-white mb-4">For Artists</h2>
            <div className="space-y-2">
              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  How much does Insound cost?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">No monthly fee. Insound takes 10% of each sale and absorbs all Stripe processing fees out of that cut. Artists keep 90%.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  How do I get paid?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">Payouts go to your bank via Stripe Connect. Set up your payout details in your Artist Dashboard.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  What file formats should I upload?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">Upload WAV files for best quality. We support WAV, FLAC, and MP3.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  Can I sell merch?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">Yes. You can list physical merchandise with photos, variants, and pricing. You handle fulfilment and shipping.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  Can I offer pre-orders?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">Yes. Set a release date and fans can pre-order. They&rsquo;ll get access when it goes live.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  What about download codes?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">You can generate batch download codes for press, promos, or giveaways from your Dashboard.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  Who owns my music?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">You do. Insound never claims ownership. You keep your masters, copyright, and publishing rights.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  Can I sell my music on other platforms too?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">Yes. We don&rsquo;t claim exclusivity. You can sell on your own website, other platforms, or anywhere else at the same time. Your music, your choice.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  Can I put my music on Spotify and Insound?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">Absolutely. Insound is for direct sales &mdash; it complements streaming, it doesn&rsquo;t replace it. Many artists use streaming for discovery and Insound for revenue.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  Is the 10% rate permanent?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">Yes. It&rsquo;s the business model, not a promotion. We absorb Stripe&rsquo;s processing fees out of our 10%. You keep 90% of every sale, permanently.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  Does Insound hold my money?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">Never. Payments go directly to your Stripe account the moment a sale completes. We take our 10% as an application fee at the point of sale. Your money is yours instantly.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  What if I want to leave Insound?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">You can remove your music and close your account at any time. Your Stripe earnings are already in your account. No lock-in, no penalty.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  Can I use a distributor and still sell on Insound?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">Yes, as long as you control the rights to sell your music. Using a non-exclusive distributor for streaming doesn&rsquo;t affect your eligibility on Insound.</p>
              </details>
            </div>
          </section>

          {/* ── General ───────────────────────────────────────── */}
          <section>
            <h2 className="font-display text-[1.35rem] font-bold text-white mb-4">General</h2>
            <div className="space-y-2">
              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  Is my data safe?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">Yes. We use Supabase (encrypted at rest), Stripe (PCI compliant), and follow UK GDPR. See our <Link href="/privacy" className="text-orange-600 hover:text-orange-400">Privacy Policy</Link>.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  How do I delete my account?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">Go to Settings &gt; Account and request deletion. There&rsquo;s a 24-hour cooldown before it&rsquo;s permanent.</p>
              </details>

              <details className="group border border-white/[0.06] rounded-xl">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-white select-none [&::-webkit-details-marker]:hidden list-none">
                  How do I contact support?
                  <span className="ml-3 text-zinc-500 text-xs transition-transform group-open:rotate-45">&#43;</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] text-zinc-400 leading-[1.75]">Email <a href="mailto:dan@getinsound.com" className="text-orange-600 hover:text-orange-400">dan@getinsound.com</a>.</p>
              </details>
            </div>
          </section>

          {/* ── Still have questions? ─────────────────────────── */}
          <section className="border-t border-white/[0.06] pt-12 text-center">
            <h2 className="font-display text-[1.35rem] font-bold text-white mb-3">Still have questions?</h2>
            <p className="text-[15px] text-zinc-400 leading-[1.75]">
              Drop us a line at{' '}
              <a href="mailto:dan@getinsound.com" className="text-orange-600 hover:text-orange-400">dan@getinsound.com</a>
              {' '}and we&rsquo;ll get back to you.
            </p>
          </section>

        </div>
      </div>

      <footer className="border-t border-zinc-900/80 py-16">
        <div className="max-w-4xl mx-auto px-6 flex flex-col items-center gap-6">
          <Link href="/" className="font-display text-lg font-bold">insound<span className="text-orange-500">.</span></Link>
          <div className="flex flex-wrap justify-center gap-6 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
            <Link href="/" className="hover:text-orange-500 transition-colors">Home</Link>
            <Link href="/for-artists" className="hover:text-orange-500 transition-colors">Artists</Link>
            <Link href="/for-fans" className="hover:text-orange-500 transition-colors">Fans</Link>
            <Link href="/for-press" className="hover:text-orange-500 transition-colors">Press</Link>
            <Link href="/privacy" className="hover:text-orange-500 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-orange-500 transition-colors">Terms</Link>
            <Link href="/ai-policy" className="hover:text-orange-500 transition-colors">AI Policy</Link>
            <Link href="/faq" className="text-orange-500">FAQ</Link>
          </div>
          <p className="text-zinc-700 text-[11px] font-medium">&copy; 2026 Insound</p>
        </div>
      </footer>
    </main>
  )
}
