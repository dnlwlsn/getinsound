import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service | Insound',
  description: 'Insound Terms of Service - the rules, rights, and responsibilities for Artists and Fans.',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen pb-24">
      <div className="max-w-2xl mx-auto px-6 py-20">
        <h1 className="text-4xl font-black tracking-tighter mb-2 font-display">Terms of Service</h1>
        <p className="text-zinc-500 text-sm mb-12">Last updated: April 2026</p>

        <div className="space-y-6 text-[15px] text-zinc-400 leading-[1.75] [&_h2]:text-[1.25rem] [&_h2]:font-black [&_h2]:text-white [&_h2]:mt-10 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-white [&_h3]:mt-6 [&_h3]:mb-2 [&_a]:text-orange-600 [&_a:hover]:text-orange-400 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1.5">

          {/* ── Identity ──────────────────────────────────────── */}
          <p>These terms govern the use of Insound at <a href="https://getinsound.com">getinsound.com</a>. The service is operated by Insound Music Ltd, a company registered in England and Wales (Company Number: 17179694), with registered office at 1 Sandhill Close, Beds, MK45 2JD. Contact: <a href="mailto:dan@getinsound.com">dan@getinsound.com</a>.</p>
          <p>Plain English where possible. If something is unclear, email <a href="mailto:dan@getinsound.com">dan@getinsound.com</a> and Insound will explain it.</p>

          {/* ── Marketplace Role ───────────────────────────────── */}
          <p>Insound provides a platform that allows independent artists to list and sell music, digital content, and merchandise directly to fans. Unless checkout states otherwise, the Artist is the seller of the Content or merchandise, and Insound acts as the platform provider and payment facilitator.</p>
          <p>For digital music purchases, Insound provides hosting, delivery, download access, and customer support tooling. For merchandise purchases, the Artist is responsible for fulfilment, delivery, returns, product descriptions, and product quality.</p>

          <h2>1. Definitions</h2>
          <ul>
            <li>&ldquo;the Platform&rdquo; or &ldquo;Insound&rdquo; &mdash; the service at getinsound.com, operated by Insound Music Ltd (Company Number: 17179694).</li>
            <li>&ldquo;Artist&rdquo; &mdash; a registered user who uploads and sells music on the Platform.</li>
            <li>&ldquo;Fan&rdquo; &mdash; anyone who purchases music, downloads Content, or browses the Platform.</li>
            <li>&ldquo;Content&rdquo; &mdash; music files, artwork, text, metadata, and any other material uploaded by an Artist to the Platform.</li>
            <li>&ldquo;Release&rdquo; &mdash; a published collection of one or more tracks (single, EP, or album).</li>
            <li>&ldquo;Merch&rdquo; &mdash; physical merchandise listed by an Artist and fulfilled directly by that Artist.</li>
            <li>&ldquo;Notice&rdquo; &mdash; a written communication sent by email to the address associated with the recipient&rsquo;s account, or published prominently on the Platform. Notice is deemed given when sent by email or when published.</li>
          </ul>

          <h2>2. Acceptance of Terms</h2>
          <p>By creating an Artist account the Artist confirms that they have read, understood, and agree to these Terms of Service, the <Link href="/privacy">Privacy Policy</Link>, and the <Link href="/ai-policy">AI Content Policy</Link>.</p>
          <p>By purchasing music or creating a Fan account the Fan agrees to these terms as they apply to Fans. Fans must be at least 16 years old to create an account or make a purchase. If a Fan is under 18, they confirm that a parent or legal guardian has consented to their use of the Platform and agrees to these terms on their behalf.</p>
          <p>The Platform may update these terms. If the Platform makes material changes, it will notify registered users by email at least 14 days before the changes take effect. Continued use after that date constitutes acceptance.</p>

          <h2>3. Artist Eligibility</h2>
          <p>Insound is for independent artists who control the rights needed to sell their music on the Platform. Labels, management companies, distributors, and other third parties may not create accounts on behalf of artists unless Insound gives written permission.</p>
          <p>Using a non-exclusive DIY distributor (such as DistroKid, TuneCore, or CD Baby) elsewhere does not by itself make an Artist ineligible, provided the Artist has the right to sell the music on Insound.</p>
          <p>By creating an Artist account the Artist confirms that:</p>
          <ul>
            <li>The Artist controls the rights needed to distribute and sell the music uploaded to the Platform.</li>
            <li>The Artist is not signing up on behalf of a record label, management company, or any entity with an exclusive commercial music distribution agreement, unless Insound has given written permission.</li>
            <li>The Artist is at least 18 years old, or has the consent of a parent or legal guardian who agrees to these terms on the Artist&rsquo;s behalf.</li>
          </ul>
          <p>If the Platform has reasonable grounds to believe an account is operated by or on behalf of a label or management entity without permission, the Platform may suspend or terminate it with Notice.</p>

          <h2>4. Content Ownership and Licence</h2>
          <p>The Artist owns everything uploaded. Insound does not claim any ownership of the Artist&rsquo;s music, artwork, or metadata. The Artist retains all copyright, publishing rights, and masters.</p>
          <p>By uploading Content to Insound, the Artist grants the Platform a limited, non-exclusive, royalty-free licence to:</p>
          <ul>
            <li>Host, store, and deliver the Content to Fans who purchase it.</li>
            <li>Generate and serve preview clips (up to 90 seconds) for promotional purposes on the Platform.</li>
            <li>Display the Artist&rsquo;s artwork, artist name, and Release metadata on the Platform and in social sharing previews.</li>
          </ul>
          <p>The Platform may allow trusted service providers to process Content solely to operate, secure, host, deliver, and support the service.</p>
          <p>This licence exists solely to operate the service. The Platform will not sub-licence the Artist&rsquo;s Content to third parties, use it in advertising, or distribute it beyond the Platform without the Artist&rsquo;s explicit consent.</p>
          <p>The Artist is responsible for ensuring they have all necessary rights, clearances, and licences for any Content uploaded &mdash; including samples, interpolations, and cover versions.</p>

          <h3>4.1 Content Deletion and Fan Access</h3>
          <p>The licence granted to the Platform ends when the Artist deletes the Content or closes their account, except that the Platform may continue to host and deliver copies for a reasonable period where needed to:</p>
          <ul>
            <li>provide existing purchasers with download access;</li>
            <li>handle refunds or disputes;</li>
            <li>comply with legal obligations;</li>
            <li>maintain security backups; or</li>
            <li>protect legal rights.</li>
          </ul>
          <p>Fans are responsible for downloading and backing up purchased files. The Platform aims to keep purchased downloads available through the Fan&rsquo;s library but does not guarantee permanent cloud storage. If an Artist removes a Release or closes their account, existing purchasers will retain download access for at least 90 days unless the Platform is legally required to remove the Content sooner.</p>

          <h2>5. Payment Terms</h2>
          <h3>5.1 How Payments Work</h3>
          <p>All payments are processed via Stripe Connect direct charges. When a Fan purchases music, the payment is created directly in the Artist&rsquo;s own Stripe account. Insound never holds, pools, or intermediates Artist funds.</p>

          <h3>5.2 Fee Structure</h3>
          <ul>
            <li>Insound fee: 10% of the sale price, deducted as a Stripe application fee at the point of sale. The Artist receives 90% of the sale price.</li>
            <li>Stripe processing fees (which vary by card type, payment method, and region) are absorbed by Insound out of its 10% platform fee. Artists are not charged processing fees.</li>
          </ul>
          <p>For example, on a &pound;10 music sale: &pound;9.00 goes to the Artist (90%) and &pound;1.00 goes to Insound (10%). Stripe&rsquo;s processing fee (approximately &pound;0.35 for a standard UK card) is deducted from Insound&rsquo;s &pound;1.00, not from the Artist&rsquo;s share.</p>

          <h3>5.3 Platform Fee</h3>
          <p>Insound&rsquo;s platform fee is 10% of the amount paid by the Fan, excluding any taxes, refunds, and chargebacks. Stripe processing fees are absorbed by Insound out of this 10% and are not charged to the Artist. This is the standard business model, not an introductory or promotional rate.</p>
          <p>The Platform will not increase the 10% platform fee for existing registered Artists without at least 90 days&rsquo; written Notice. Any increase will apply only to sales made after the effective date.</p>

          <h3>5.4 Minimum Sale Price</h3>
          <p>The minimum price for a Release is &pound;3. This ensures the Stripe processing fee does not consume a disproportionate share of small transactions.</p>

          <h3>5.5 Pay What You Want</h3>
          <p>Artists may enable pay-what-you-want pricing on any Release. When enabled:</p>
          <ul>
            <li>The Artist sets a minimum price (no lower than &pound;3).</li>
            <li>Fans may pay any amount at or above the minimum.</li>
            <li>Insound takes 10% of the actual amount paid, not the minimum. If the minimum is &pound;5 and a Fan pays &pound;20, Insound receives &pound;2 (from which Stripe processing is deducted), and the Artist receives &pound;18.</li>
          </ul>

          <h3>5.6 Withdrawals</h3>
          <p>There is no minimum withdrawal threshold. The Artist&rsquo;s earnings are in their Stripe account from the moment the transaction completes. Withdrawals to the Artist&rsquo;s bank follow Stripe&rsquo;s standard payout schedule. Insound has no involvement in or control over payout timing once funds are in the Artist&rsquo;s Stripe account.</p>

          <h3>5.7 Currency</h3>
          <p>All prices are currently listed and settled in GBP (&pound;). The Platform may add additional currencies in future.</p>

          <h2>6. Taxes</h2>
          <p>Prices displayed on the Platform may include VAT or other applicable taxes where required by law. The Platform will clearly indicate at checkout whether a price includes or excludes VAT.</p>
          <p>Artists are responsible for their own income tax, VAT, sales tax, and other tax obligations arising from their sales on the Platform, except where Insound is legally required to collect, report, or account for tax as a platform or marketplace operator.</p>
          <p>The Platform may collect tax information from Artists (such as VAT registration status) and may withhold, report, or remit amounts where required by law. Artists must keep their tax information accurate and up to date.</p>

          <h2>7. Purchases and Digital Content</h2>
          <p>Fans can purchase music without creating an account. A purchase with an email address creates a lightweight record associated with that email for download access. Fans may later create a full account to access their purchase history and collection.</p>
          <p>Fan accounts are subject to the same prohibited-content rules (section 12) and general conduct expectations (section 8).</p>

          <h3>7.1 Digital Content Cancellation Rights</h3>
          <p>Digital music is supplied as digital content. If the Fan requests immediate access, the Fan must expressly agree that the download may begin during the 14-day cancellation period and acknowledge that the right to cancel will be lost once the download starts.</p>
          <p>This does not affect the Fan&rsquo;s statutory rights if the download is faulty, corrupted, not as described, or not supplied.</p>

          <h2>8. Fan Conduct</h2>
          <p>Fans agree not to:</p>
          <ul>
            <li>Use the Platform for fraudulent purposes, including payment fraud, fake accounts, or chargebacks made in bad faith.</li>
            <li>Scrape, crawl, or use automated tools to extract data or Content from the Platform without written permission.</li>
            <li>Redistribute, resell, or publicly share purchased Content, download codes, or access credentials.</li>
            <li>Attempt to circumvent access controls, payment systems, or download restrictions.</li>
            <li>Harass, abuse, or send unsolicited messages to Artists or other users through the Platform.</li>
            <li>Create multiple accounts to exploit promotions, download codes, or free tiers.</li>
            <li>Use the Platform in any way that violates applicable UK law.</li>
          </ul>
          <p>The Platform may suspend or terminate a Fan account that breaches these rules, with Notice where reasonably practicable.</p>

          <h2>9. Refunds, Disputes, and Chargebacks</h2>
          <p>Digital music purchases are generally non-refundable once the download has been accessed, in accordance with the Consumer Contracts Regulations 2013. Refunds will be issued where:</p>
          <ul>
            <li>The download is materially defective (corrupted files, wrong content delivered).</li>
            <li>A pre-order is cancelled or delayed beyond the terms in section 11.</li>
            <li>A duplicate charge occurred.</li>
          </ul>
          <p>Refund requests: <a href="mailto:dan@getinsound.com">dan@getinsound.com</a>.</p>
          <p>If a purchase is refunded, disputed, reversed, or charged back, the Artist may be responsible for the refunded amount, any chargeback fees imposed by Stripe, and any resulting negative Stripe balance, except where the issue was caused by Insound&rsquo;s error or a Platform fault.</p>
          <p>Insound will refund its 10% platform fee where:</p>
          <ul>
            <li>required by law;</li>
            <li>the purchase is refunded due to Insound&rsquo;s error;</li>
            <li>a pre-order is cancelled by the Artist (see Pre-orders); or</li>
            <li>the Platform chooses to do so as a goodwill gesture.</li>
          </ul>
          <p>Stripe processing fees may not be returned by Stripe on refunds. Where a pre-order is cancelled by the Artist, Stripe&rsquo;s non-refundable processing fee is absorbed by the Platform. Neither the Artist nor the Fan bears this cost.</p>
          <p>The Platform may suspend sales, downloads, or payouts for an Artist account where repeated disputes, fraud, or chargebacks create legal, payment, or platform risk.</p>

          <h2>10. Merch</h2>
          <p>Artists may list physical merchandise on their Insound page. Merch is fulfilled entirely by the Artist. Insound facilitates payment collection only.</p>
          <ul>
            <li>The Artist is responsible for product quality, accurate descriptions, packaging, shipping, tracking, and delivery timescales.</li>
            <li>The Artist is responsible for compliance with consumer protection law, including the Consumer Rights Act 2015 and distance selling regulations.</li>
            <li>Insound&rsquo;s 10% fee applies to Merch transactions in the same way as music sales.</li>
            <li>Insound is not liable for lost, damaged, or delayed shipments, or for disputes between Artists and Fans about Merch quality or fulfilment.</li>
          </ul>

          <h3>10.1 Merch Returns</h3>
          <p>For merchandise, the Artist must provide accurate product descriptions, shipping times, delivery charges, return instructions, and a valid contact method.</p>
          <p>For most online merchandise purchases, Fans may cancel within 14 days after delivery and then have 14 days to return the goods. Exceptions may apply, including personalised or custom-made items, sealed items not suitable for return for health or hygiene reasons once unsealed, and other exceptions permitted by law.</p>
          <p>Return postage costs are the responsibility of the Fan unless the item is faulty or not as described.</p>

          <h2>11. Pre-orders</h2>
          <p>Artists may list Releases as pre-orders. When a Fan pre-orders:</p>
          <ul>
            <li>Payment is taken at the time of purchase.</li>
            <li>The download becomes available on the Artist-specified release date.</li>
            <li>If the Release is delayed by more than 30 days beyond the stated date without the Artist providing an updated release date, the Fan is entitled to a full refund.</li>
            <li>If the Release is cancelled entirely, all pre-order purchasers will be refunded automatically.</li>
          </ul>

          <h2>12. Prohibited Content</h2>
          <p>The following may not be uploaded or sold on the Platform:</p>
          <ul>
            <li>Content that infringes the copyright, trademark, or other intellectual property rights of any third party.</li>
            <li>Fully AI-generated Content, as defined in the <Link href="/ai-policy">AI Content Policy</Link>.</li>
            <li>Unlicensed samples or interpolations.</li>
            <li>Content that promotes violence, hatred, or discrimination against individuals or groups.</li>
            <li>Sexually explicit content involving minors.</li>
            <li>Fraudulent, misleading Content, or Content that impersonates another artist.</li>
            <li>Content that violates any applicable UK law, including content that constitutes a criminal offence under the Online Safety Act 2023.</li>
          </ul>
          <p>The Platform uses human review for final decisions on content reports wherever reasonably practicable. The Platform may use automated tools to help detect, prioritise, or prevent spam, fraud, malware, illegal content, or policy violations.</p>

          <h2>13. Content Reporting and Copyright</h2>
          <h3>13.1 Reporting Content</h3>
          <p>Anyone may report Content that they believe violates these terms, infringes intellectual property rights, or is illegal. Reports can be submitted to <a href="mailto:dan@getinsound.com">dan@getinsound.com</a> and should include:</p>
          <ul>
            <li>A description of the Content and a link to it on the Platform.</li>
            <li>An explanation of why the Content is believed to violate these terms or the law.</li>
            <li>The reporter&rsquo;s contact information.</li>
          </ul>
          <p>The Platform will acknowledge reports promptly and aim to review and act on them within 7 days. The Platform may remove or restrict access to Content during review where there is a risk of serious harm or clear illegality.</p>

          <h3>13.2 Copyright Infringement Notices</h3>
          <p>If a rights holder believes their copyright has been infringed, they should submit a notice to <a href="mailto:dan@getinsound.com">dan@getinsound.com</a> that includes:</p>
          <ul>
            <li>Identification of the copyrighted work claimed to have been infringed.</li>
            <li>Identification of the infringing Content on the Platform, including a link.</li>
            <li>A statement that the rights holder has a good-faith belief that the use is not authorised.</li>
            <li>The rights holder&rsquo;s name, contact details, and a statement that the information provided is accurate.</li>
          </ul>
          <p>Upon receiving a valid notice, the Platform will remove or disable access to the Content and notify the Artist. The Artist may submit a counter-notice if they believe the removal was made in error.</p>

          <h3>13.3 Counter-Notices</h3>
          <p>If an Artist believes their Content was removed in error, they may submit a counter-notice to <a href="mailto:dan@getinsound.com">dan@getinsound.com</a> explaining why the Content does not infringe and providing evidence of their rights. The Platform will forward the counter-notice to the original reporter, who then has 14 days to pursue legal action. If no action is taken, the Platform may restore the Content.</p>

          <h3>13.4 Repeat Infringers</h3>
          <p>The Platform maintains a repeat-infringer policy. Artists who receive multiple valid infringement notices may have their account suspended or terminated. The number and severity of infringements will be considered on a case-by-case basis.</p>

          <h2>14. Appeals</h2>
          <p>If an Artist&rsquo;s Content is removed or their account is suspended or terminated under these terms, the Artist may appeal by emailing <a href="mailto:dan@getinsound.com">dan@getinsound.com</a> within 30 days of the action. The appeal should include:</p>
          <ul>
            <li>The Artist&rsquo;s account details and the action being appealed.</li>
            <li>An explanation of why the Artist believes the action was wrong or disproportionate.</li>
            <li>Any supporting evidence.</li>
          </ul>
          <p>The Platform will review the appeal and respond within 14 days. Appeals are reviewed by a person who was not involved in the original decision wherever reasonably practicable. The Platform&rsquo;s decision on appeal is final, but does not affect any legal rights the Artist may have.</p>

          <h2>15. Download Codes</h2>
          <p>Artists may purchase download codes to distribute at gigs, with Merch, or through other channels. Terms:</p>
          <ul>
            <li>Each code grants the holder a one-time download of the associated Release.</li>
            <li>Codes have a maximum use limit set by the Artist (default: 1 redemption per code).</li>
            <li>Codes expire 12 months from the date of issue unless the Artist sets a shorter expiry.</li>
            <li>Expired or fully redeemed codes cannot be reactivated. No refunds are issued for unused codes.</li>
          </ul>

          <h2>16. Private and Unlisted Releases</h2>
          <p>Artists may publish Releases as private or unlisted. These are accessible only via a direct link shared by the Artist. Private Releases:</p>
          <ul>
            <li>Do not appear in search results, browse pages, or public Artist profiles.</li>
            <li>Are subject to the same content policies as public Releases.</li>
            <li>May be purchased by anyone with the direct link.</li>
          </ul>

          <h2>17. Collectives</h2>
          <p>Collectives are not currently available. If the Platform launches collectives, additional terms may apply and Artists will be asked to accept them before using the feature.</p>

          <h2>18. Account Termination</h2>
          <h3>18.1 By the Artist</h3>
          <p>The Artist may delete their account at any time via the Account Settings page at <strong>/dashboard/settings</strong>. Upon requesting deletion:</p>
          <ul>
            <li>A 24-hour cooldown period begins. The Artist may cancel the request at any time before the deadline via the Account Settings page or the cancellation link sent by email.</li>
            <li>A confirmation email is sent immediately, and a final reminder is sent 1 hour before deletion.</li>
            <li>Once the cooldown expires, the deletion is processed automatically.</li>
          </ul>
          <p>When an Artist account is deleted:</p>
          <ul>
            <li>All Releases are removed from the Platform. Existing purchasers retain download access for 90 days, after which files are permanently deleted from storage.</li>
            <li>Active pre-orders are cancelled and fully refunded to affected Fans.</li>
            <li>The Artist&rsquo;s profile, posts, and uploaded media are permanently removed.</li>
            <li>The Artist&rsquo;s Stripe connected account remains active until all pending payouts have settled, then it is disconnected.</li>
            <li>The Artist&rsquo;s fan account and collection are also deleted (see 18.3 below).</li>
          </ul>
          <h3>18.2 By the Fan</h3>
          <p>Fans may delete their account at any time via the Account Settings page at <strong>/settings/account</strong>. The same 24-hour cooldown and cancellation process applies. Upon deletion:</p>
          <ul>
            <li>The Fan&rsquo;s profile, collection, preferences, and all associated personal data are permanently removed.</li>
            <li>Purchase records are anonymised rather than hard-deleted: the Fan&rsquo;s user ID and email are removed from purchase rows, but financial amounts are retained for the Artist&rsquo;s accounting and aggregate analytics.</li>
            <li>Download links for all purchased music are sent by email and remain active for 48 hours after deletion. Fans are encouraged to download their purchases before requesting deletion.</li>
          </ul>
          <h3>18.3 By Insound</h3>
          <p>The Platform may suspend or terminate an account if:</p>
          <ul>
            <li>The Artist materially breaches these terms (e.g. uploading infringing Content, misrepresenting independence status).</li>
            <li>The account is inactive for more than 24 months with no published Releases.</li>
            <li>Continued operation of the account would expose Insound to legal liability.</li>
          </ul>
          <p>Except in cases of serious legal risk, the Platform will provide at least 14 days&rsquo; Notice before termination, with an explanation and an opportunity to respond.</p>
          <h3>18.4 Data Handling on Deletion</h3>
          <p>When an account is deleted, the Platform removes all personal data except where retention is required for:</p>
          <ul>
            <li>legal or regulatory compliance (e.g. financial records required under HMRC rules);</li>
            <li>fulfilling obligations to other users (e.g. providing download access to existing purchasers for 90 days); or</li>
            <li>preserving anonymised, non-personal aggregate data for Artist analytics.</li>
          </ul>
          <p>Anonymised purchase records contain no information that can identify the deleted user. The Fan&rsquo;s user ID is set to null and the email address is replaced with a non-functional placeholder.</p>

          <h3>18.5 Data Portability</h3>
          <p>Upon request, the Platform will provide a machine-readable export of the Artist&rsquo;s profile data, sales and earnings history, and fan/supporter list (subject to applicable data protection law). The Platform will fulfil data export requests within 30 days.</p>

          <h2>19. Liability</h2>
          <p>Insound is provided &ldquo;as is&rdquo;. To the fullest extent permitted by law:</p>
          <ul>
            <li>The Platform does not guarantee uninterrupted access.</li>
            <li>The Platform is not liable for loss of earnings due to downtime, bugs, or third-party service outages (including Stripe).</li>
            <li>The Platform&rsquo;s total liability to any user in any 12-month period shall not exceed the fees the Platform collected from that user during the same period.</li>
          </ul>
          <p>Nothing in these terms excludes or limits liability for:</p>
          <ul>
            <li>death or personal injury caused by negligence;</li>
            <li>fraud or fraudulent misrepresentation;</li>
            <li>any liability that cannot be excluded or limited under applicable law, including statutory consumer rights under the Consumer Rights Act 2015; or</li>
            <li>breaches of data protection law.</li>
          </ul>

          <h2>20. Dispute Resolution</h2>
          <p>If any user has a dispute with Insound, they should contact <a href="mailto:dan@getinsound.com">dan@getinsound.com</a>. The Platform will attempt to resolve it informally within 30 days.</p>
          <p>If informal resolution fails, disputes may be referred to mediation before proceeding to court.</p>

          <h2>21. Governing Law</h2>
          <p>These terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales, except where consumer protection law grants the Fan the right to bring proceedings in their local jurisdiction.</p>

          <h2>22. Data Protection</h2>
          <p>The Platform processes personal data in accordance with UK GDPR and the Data Protection Act 2018. Full details are in the <Link href="/privacy">Privacy Policy</Link>.</p>

          <h2>23. Contact</h2>
          <p>Insound Music Ltd<br />Company Number: 17179694<br />Registered in England and Wales<br />Registered office: 1 Sandhill Close, Beds, MK45 2JD<br />Email: <a href="mailto:dan@getinsound.com">dan@getinsound.com</a></p>
        </div>
      </div>

      <footer className="border-t border-zinc-900 py-10 text-center">
        <p className="text-zinc-700 text-xs">&copy; 2026 Insound &nbsp;&middot;&nbsp; <Link href="/privacy" className="hover:text-zinc-500 transition-colors">Privacy</Link> &nbsp;&middot;&nbsp; <Link href="/ai-policy" className="hover:text-zinc-500 transition-colors">AI Policy</Link> &nbsp;&middot;&nbsp; <Link href="/" className="hover:text-zinc-500 transition-colors">Home</Link></p>
      </footer>
    </main>
  )
}
