import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service | Insound',
  description: 'Insound Terms of Service — the rules, rights, and responsibilities for artists and fans.',
}

export default function TermsPage() {
  return (
    <main className="bg-[#0A0A0A] text-white min-h-screen">
      <nav className="sticky top-0 w-full z-50 flex justify-between items-center px-6 md:px-14 py-5 border-b border-zinc-900/80" style={{ background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <Link href="/" className="text-2xl font-black text-orange-600 tracking-tighter hover:text-orange-500 transition-colors font-display">insound.</Link>
        <Link href="/" className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">&larr; Back</Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-20">
        <h1 className="text-4xl font-black tracking-tighter mb-2 font-display">Terms of Service</h1>
        <p className="text-zinc-500 text-sm mb-12">Last updated: April 2026</p>

        <div className="space-y-6 text-[15px] text-zinc-400 leading-[1.75] [&_h2]:text-[1.25rem] [&_h2]:font-black [&_h2]:text-white [&_h2]:mt-10 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-white [&_h3]:mt-6 [&_h3]:mb-2 [&_a]:text-orange-600 [&_a:hover]:text-orange-400 [&_strong]:text-white [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1.5">

          <p>These terms govern your use of Insound (<a href="https://getinsound.com">getinsound.com</a>), operated by Insound, a company registered in England and Wales. By creating an account or purchasing music, you agree to these terms.</p>
          <p>Plain English where possible. If something is unclear, email <a href="mailto:dan@getinsound.com">dan@getinsound.com</a> and we&apos;ll explain it.</p>

          <h2>1. Definitions</h2>
          <ul>
            <li><strong>&ldquo;Insound&rdquo;</strong>, <strong>&ldquo;we&rdquo;</strong>, <strong>&ldquo;us&rdquo;</strong> &mdash; Insound.</li>
            <li><strong>&ldquo;Artist&rdquo;</strong> &mdash; a registered user who uploads and sells music on the platform.</li>
            <li><strong>&ldquo;Fan&rdquo;</strong> &mdash; anyone who purchases music, downloads content, or browses the platform.</li>
            <li><strong>&ldquo;Content&rdquo;</strong> &mdash; music files, artwork, text, and metadata uploaded by an Artist.</li>
            <li><strong>&ldquo;Release&rdquo;</strong> &mdash; a published collection of one or more tracks (single, EP, or album).</li>
            <li><strong>&ldquo;Merch&rdquo;</strong> &mdash; physical merchandise listed by an Artist and fulfilled directly by that Artist.</li>
          </ul>

          <h2>2. Acceptance of terms</h2>
          <p>By creating an artist account you confirm that you have read, understood, and agree to these Terms of Service, our <Link href="/privacy">Privacy Policy</Link>, and our <Link href="/ai-policy">AI Content Policy</Link>.</p>
          <p>By purchasing music or creating a fan account you agree to these terms as they apply to fans.</p>
          <p>We may update these terms. If we make material changes, we will notify registered users by email at least 14 days before the changes take effect. Continued use after that date constitutes acceptance.</p>

          <h2>3. Artist eligibility</h2>
          <p>Insound is for <strong>independent and unsigned artists only</strong>. By creating an artist account you confirm that:</p>
          <ul>
            <li>You are not signing up on behalf of a record label, management company, or any entity with a commercial music distribution agreement.</li>
            <li>You have the legal right to distribute and sell the music you upload.</li>
            <li>You are at least 18 years old, or have the consent of a parent or legal guardian who agrees to these terms on your behalf.</li>
          </ul>
          <p>If we have reasonable grounds to believe an account is operated by or on behalf of a label or management entity, we may suspend or terminate it with notice.</p>

          <h2>4. Content ownership and licence</h2>
          <p><strong>You own everything you upload.</strong> Insound does not claim any ownership of your music, artwork, or metadata. You retain all copyright, publishing rights, and masters.</p>
          <p>By uploading content to Insound, you grant us a <strong>limited, non-exclusive, royalty-free licence</strong> to:</p>
          <ul>
            <li>Host, store, and deliver your content to fans who purchase it.</li>
            <li>Generate and serve preview clips (up to 90 seconds) for promotional purposes on the platform.</li>
            <li>Display your artwork, artist name, and release metadata on the platform and in social sharing previews.</li>
          </ul>
          <p>This licence exists solely to operate the service. It terminates when you delete your content or close your account. We will not sub-licence your content to third parties, use it in advertising, or distribute it beyond the platform without your explicit consent.</p>
          <p>You are responsible for ensuring you have all necessary rights, clearances, and licences for any content you upload &mdash; including samples, interpolations, and cover versions.</p>

          <h2>5. Payment terms</h2>
          <h3>5.1 How payments work</h3>
          <p>All payments are processed via <strong>Stripe Connect direct charges</strong>. When a fan purchases music, the payment is created directly in the artist&apos;s own Stripe account. Insound never holds, pools, or intermediates artist funds.</p>
          <h3>5.2 Fee structure</h3>
          <ul>
            <li><strong>Insound fee:</strong> 10% of the sale price, deducted as a Stripe application fee at the point of sale.</li>
            <li><strong>Stripe processing fee:</strong> 1.5% + 20p per transaction. This is Stripe&apos;s standard UK rate, passed through at cost. Insound does not mark up the Stripe fee.</li>
          </ul>
          <p>On a &pound;10 sale: &pound;8.65 to the artist, &pound;1.00 to Insound, 35p to Stripe. The fee breakdown is shown transparently at checkout.</p>
          <h3>5.3 The 10% split is permanent</h3>
          <p>The 10% Insound fee is the business model, not a promotional rate. It applies from your first sale with no thresholds, tiers, or time limits. We will not change this split without at least 90 days&apos; written notice to all registered artists.</p>
          <h3>5.4 Minimum sale price</h3>
          <p>The minimum price for a release is <strong>&pound;2</strong>. This ensures the Stripe processing fee doesn&apos;t consume a disproportionate share of small transactions.</p>
          <h3>5.5 Pay what you want</h3>
          <p>Artists may enable pay-what-you-want pricing on any release. When enabled:</p>
          <ul>
            <li>The artist sets a minimum price (no lower than &pound;2).</li>
            <li>Fans may pay any amount at or above the minimum.</li>
            <li>Insound takes 10% of the <strong>actual amount paid</strong>, not the minimum. If the minimum is &pound;5 and a fan pays &pound;20, Insound receives &pound;2, the artist receives &pound;18 (minus Stripe&apos;s fee).</li>
          </ul>
          <h3>5.6 Withdrawals</h3>
          <p>There is no minimum withdrawal threshold. Your earnings are in your Stripe account from the moment the transaction completes. Withdrawals to your bank follow Stripe&apos;s standard payout schedule. Insound has no involvement in or control over payout timing once funds are in your Stripe account.</p>
          <h3>5.7 Currency</h3>
          <p>All prices are currently listed and settled in GBP (&pound;). We may add additional currencies in future.</p>

          <h2>6. Fan accounts</h2>
          <p>Fans can purchase music without creating an account. A purchase with an email address creates a lightweight record associated with that email for download access. Fans may later create a full account to access their purchase history and library.</p>
          <p>Fan accounts are subject to the same prohibited-content rules (section 9) and general conduct expectations.</p>

          <h2>7. Merch</h2>
          <p>Artists may list physical merchandise on their Insound page. Merch is <strong>fulfilled entirely by the artist</strong>. Insound facilitates payment collection only.</p>
          <ul>
            <li>The artist is responsible for product quality, accurate descriptions, packaging, shipping, tracking, and delivery timescales.</li>
            <li>The artist is responsible for compliance with consumer protection law, including the Consumer Rights Act 2015 and distance selling regulations.</li>
            <li>Insound&apos;s 10% fee applies to merch transactions in the same way as music sales.</li>
            <li>Insound is not liable for lost, damaged, or delayed shipments, or for disputes between artists and fans about merch quality or fulfilment.</li>
          </ul>

          <h2>8. Pre-orders</h2>
          <p>Artists may list releases as pre-orders. When a fan pre-orders:</p>
          <ul>
            <li>Payment is taken at the time of purchase.</li>
            <li>The download becomes available on the artist-specified release date.</li>
            <li>If the release is delayed by more than 30 days beyond the stated date without the artist providing an updated release date, the fan is entitled to a full refund.</li>
            <li>If the release is cancelled entirely, all pre-order purchasers will be refunded automatically.</li>
          </ul>

          <h2>9. Download codes</h2>
          <p>Artists may purchase download codes to distribute at gigs, with merch, or through other channels. Terms:</p>
          <ul>
            <li>Each code grants the holder a one-time download of the associated release.</li>
            <li>Codes have a maximum use limit set by the artist (default: 1 redemption per code).</li>
            <li>Codes expire 12 months from the date of issue unless the artist sets a shorter expiry.</li>
            <li>Expired or fully redeemed codes cannot be reactivated. No refunds are issued for unused codes.</li>
          </ul>

          <h2>10. Private and unlisted releases</h2>
          <p>Artists may publish releases as private or unlisted. These are accessible only via a direct link shared by the artist. Private releases:</p>
          <ul>
            <li>Do not appear in search results, browse pages, or public artist profiles.</li>
            <li>Are subject to the same content policies as public releases.</li>
            <li>May be purchased by anyone with the direct link.</li>
          </ul>

          <h2>11. Prohibited content</h2>
          <p>You may not upload or sell content that:</p>
          <ul>
            <li>Infringes the copyright, trademark, or other intellectual property rights of any third party.</li>
            <li>Is fully AI-generated, as defined in our <Link href="/ai-policy">AI Content Policy</Link>.</li>
            <li>Contains unlicensed samples or interpolations.</li>
            <li>Promotes violence, hatred, or discrimination against individuals or groups.</li>
            <li>Contains sexually explicit content involving minors.</li>
            <li>Is fraudulent, misleading, or impersonates another artist.</li>
            <li>Violates any applicable UK law.</li>
          </ul>
          <p>We handle content reports through human review, not automated systems.</p>

          <h2>12. Collectives (future feature)</h2>
          <p>We plan to offer shared pages and split wallets for bands, duos, and artist collectives. When launched:</p>
          <ul>
            <li>The same independence rules apply &mdash; collectives must be artist-run, not label-operated.</li>
            <li>The same 10% fee structure applies to collective sales.</li>
            <li>Revenue splits within a collective are configured by the collective members and enforced at the point of sale.</li>
          </ul>

          <h2>13. Account termination</h2>
          <h3>13.1 By the artist</h3>
          <p>You may close your account at any time by emailing <a href="mailto:dan@getinsound.com">dan@getinsound.com</a>. Upon closure:</p>
          <ul>
            <li>Your releases will be unpublished and removed from the platform within 7 days.</li>
            <li>Existing purchasers retain their download access for a minimum of 90 days after account closure.</li>
            <li>Any pending Stripe balance remains in your Stripe account &mdash; we have no ability to withhold it.</li>
            <li>We will delete your personal data in accordance with our <Link href="/privacy">Privacy Policy</Link>.</li>
          </ul>
          <h3>13.2 By Insound</h3>
          <p>We may suspend or terminate an account if:</p>
          <ul>
            <li>The artist materially breaches these terms (e.g. uploading infringing content, misrepresenting independence status).</li>
            <li>The account is inactive for more than 24 months with no published releases.</li>
            <li>Continued operation of the account would expose Insound to legal liability.</li>
          </ul>
          <p>Except in cases of serious legal risk, we will provide at least 14 days&apos; notice before termination, with an explanation and an opportunity to respond.</p>
          <h3>13.3 Data portability</h3>
          <p>Upon request, we will provide a machine-readable export of your artist profile data, sales and earnings history, and fan/supporter list (subject to applicable data protection law). We will fulfil data export requests within 30 days.</p>

          <h2>14. Refunds</h2>
          <p>Digital music purchases are generally non-refundable once the download has been accessed, in accordance with the Consumer Contracts Regulations 2013.</p>
          <p>Refunds will be issued in the following cases:</p>
          <ul>
            <li>The download is materially defective (corrupted files, wrong content delivered).</li>
            <li>A pre-order is cancelled or delayed beyond the terms in section 8.</li>
            <li>A duplicate charge occurred.</li>
          </ul>
          <p>Refund requests: <a href="mailto:dan@getinsound.com">dan@getinsound.com</a>.</p>

          <h2>15. Liability</h2>
          <p>Insound is provided &ldquo;as is&rdquo;. To the fullest extent permitted by law:</p>
          <ul>
            <li>We do not guarantee uninterrupted access to the platform.</li>
            <li>We are not liable for loss of earnings due to platform downtime, bugs, or third-party service outages (including Stripe).</li>
            <li>Our total liability to any user in any 12-month period shall not exceed the fees we collected from that user during the same period.</li>
          </ul>
          <p>Nothing in these terms limits liability for death or personal injury caused by negligence, fraud, or any other liability that cannot be excluded under English law.</p>

          <h2>16. Dispute resolution</h2>
          <p>If you have a dispute with Insound, contact us at <a href="mailto:dan@getinsound.com">dan@getinsound.com</a>. We will attempt to resolve it informally within 30 days.</p>
          <p>If informal resolution fails, disputes may be referred to mediation before proceeding to court.</p>

          <h2>17. Governing law</h2>
          <p>These terms are governed by the laws of <strong>England and Wales</strong>. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales, except where consumer protection law grants you the right to bring proceedings in your local jurisdiction.</p>

          <h2>18. Data protection</h2>
          <p>We process personal data in accordance with UK GDPR and the Data Protection Act 2018. Full details are in our <Link href="/privacy">Privacy Policy</Link>.</p>

          <h2>19. Contact</h2>
          <p>Insound<br />Email: <a href="mailto:dan@getinsound.com">dan@getinsound.com</a></p>
        </div>
      </div>

      <footer className="border-t border-zinc-900 py-10 text-center">
        <p className="text-zinc-700 text-xs">&copy; 2026 Insound &nbsp;&middot;&nbsp; <Link href="/privacy" className="hover:text-zinc-500 transition-colors">Privacy</Link> &nbsp;&middot;&nbsp; <Link href="/ai-policy" className="hover:text-zinc-500 transition-colors">AI Policy</Link> &nbsp;&middot;&nbsp; <Link href="/" className="hover:text-zinc-500 transition-colors">Home</Link></p>
      </footer>
    </main>
  )
}
