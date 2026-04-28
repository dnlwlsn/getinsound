import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Privacy Policy | Insound',
  description: 'Insound Privacy Policy - how we collect, use, and protect your personal data under UK GDPR.',
}

export default function PrivacyPage() {
  return (
    <main className="bg-zinc-950 text-white min-h-screen">
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div id="navInner" className="mx-4 mt-4 px-5 py-3 rounded-2xl ring-1 ring-white/[0.05] flex items-center justify-between" style={{ background: 'rgba(5,5,5,0.75)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
          <Link href="/" className="font-display text-lg font-bold">insound<span className="text-orange-500">.</span></Link>
          <Link href="/" className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">&larr; Home</Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 pt-36 pb-24">
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] mb-3">Privacy Policy</h1>
        <p className="text-zinc-500 text-sm mb-16">Last updated: April 2026 &nbsp;&middot;&nbsp; Effective: April 2026</p>

        <div className="prose-custom space-y-8 text-[15px] text-zinc-400 leading-[1.85] [&_h2]:font-display [&_h2]:text-[1.35rem] [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-12 [&_h2]:mb-3 [&_h3]:font-display [&_h3]:text-[1.05rem] [&_h3]:font-bold [&_h3]:text-white [&_h3]:mt-6 [&_h3]:mb-2 [&_a]:text-orange-600 [&_a:hover]:text-orange-400 [&_strong]:text-white [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1.5 [&_table]:w-full [&_table]:text-sm [&_th]:p-3 [&_th]:text-left [&_th]:text-white [&_th]:font-bold [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-widest [&_td]:p-3 [&_td]:border-b [&_td]:border-white/[0.06] [&_code]:text-orange-400 [&_code]:text-[13px]">

          <h2>1. Who we are</h2>
          <p>Insound Music Ltd (&ldquo;Insound&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is the data controller responsible for your personal data. We are a company registered in England and Wales (Company Number: 17179694).</p>
          <table><tbody>
            <tr><td><strong>Registered name</strong></td><td>Insound Music Ltd</td></tr>
            <tr><td><strong>Company number</strong></td><td>17179694</td></tr>
            <tr><td><strong>Contact email</strong></td><td><a href="mailto:privacy@getinsound.com">privacy@getinsound.com</a></td></tr>
            <tr><td><strong>Website</strong></td><td><a href="https://getinsound.com">getinsound.com</a></td></tr>
          </tbody></table>
          <p>This policy applies to all visitors, fans, and artists who use the Insound website and platform. It explains what personal data we collect, why, how long we keep it, who we share it with, and your rights under UK data protection law (UK GDPR and the Data Protection Act 2018).</p>

          <h2>2. What data we collect and why</h2>
          <p>We collect different data depending on how you use Insound. We only collect what is necessary for each purpose.</p>

          <h3>2.1 Artists</h3>
          <table><thead><tr><th>Data</th><th>Purpose</th></tr></thead><tbody>
            <tr><td>Name</td><td>Display name on your artist profile and releases</td></tr>
            <tr><td>Email address</td><td>Account login, transactional notifications (sales, payouts), and optional marketing</td></tr>
            <tr><td>Stripe Connect details</td><td>To process and route payments to your Stripe account. Card data is handled entirely by Stripe &mdash; we never see or store it</td></tr>
            <tr><td>Uploaded files (audio, artwork)</td><td>To host and deliver your music to buyers</td></tr>
            <tr><td>Independence confirmation (boolean + timestamp)</td><td>To verify eligibility &mdash; Insound is restricted to independent and unsigned artists. We record that you confirmed this and when</td></tr>
            <tr><td>Sales analytics (amounts, timestamps, buyer count)</td><td>To provide your dashboard earnings data and generate aggregate platform statistics</td></tr>
          </tbody></table>

          <h3>2.2 Fans</h3>
          <table><thead><tr><th>Data</th><th>Purpose</th></tr></thead><tbody>
            <tr><td>Email address (collected at purchase)</td><td>To deliver download links, purchase receipts, and optional marketing if you opt in</td></tr>
            <tr><td>Purchase history (releases bought, amounts, dates)</td><td>To provide your collection, re-download access, and generate artist sales reports</td></tr>
            <tr><td>Pay-what-you-want amounts</td><td>To process the transaction at the price you chose</td></tr>
          </tbody></table>

          <h3>2.3 All users</h3>
          <table><thead><tr><th>Data</th><th>Purpose</th></tr></thead><tbody>
            <tr><td>IP address, browser type, device info</td><td>Automatically collected by Cloudflare for security, DDoS protection, and basic analytics. We do not use this to identify individuals</td></tr>
            <tr><td>localStorage values</td><td>To remember view preferences and authentication state. These are not cookies and are not shared with third parties</td></tr>
          </tbody></table>

          <h2>3. Legal basis for processing</h2>
          <p>Under UK GDPR Article 6(1), we rely on the following legal bases:</p>
          <table><thead><tr><th>Basis</th><th>Applies to</th></tr></thead><tbody>
            <tr><td><strong>Consent</strong> &mdash; Art. 6(1)(a)</td><td>Marketing emails. You can withdraw consent at any time via the unsubscribe link in any email or by contacting us</td></tr>
            <tr><td><strong>Contract</strong> &mdash; Art. 6(1)(b)</td><td>Processing artist and fan data necessary to provide the platform: account creation, file hosting, payment processing, download delivery</td></tr>
            <tr><td><strong>Legitimate interest</strong> &mdash; Art. 6(1)(f)</td><td>Basic analytics, fraud prevention, platform security, and improving the service</td></tr>
            <tr><td><strong>Legal obligation</strong> &mdash; Art. 6(1)(c)</td><td>Retaining transaction records as required by UK tax and accounting law (HMRC)</td></tr>
          </tbody></table>

          <h2>4. How long we keep your data</h2>
          <table><thead><tr><th>Data type</th><th>Retention period</th></tr></thead><tbody>
            <tr><td>Artist account data</td><td>Duration of your account plus 6 years after deletion (UK tax record-keeping)</td></tr>
            <tr><td>Fan purchase history</td><td>Duration of your account plus 6 years (UK tax/accounting obligations)</td></tr>
            <tr><td>Uploaded audio files &amp; artwork</td><td>Deleted within 30 days of an artist removing a release or closing their account</td></tr>
            <tr><td>Stripe Connect details</td><td>Managed by Stripe under their retention policy. We store only the Stripe account ID</td></tr>
            <tr><td>Server logs (IP, device info)</td><td>Automatically purged by Cloudflare (typically 72 hours)</td></tr>
          </tbody></table>

          <h2>5. Third-party processors</h2>
          <p>We share personal data only with processors who are necessary to operate the platform.</p>
          <table><thead><tr><th>Processor</th><th>Purpose</th><th>Data shared</th></tr></thead><tbody>
            <tr><td><strong>Supabase</strong></td><td>Database, authentication, file storage</td><td>All account data, uploaded files, purchase records</td></tr>
            <tr><td><strong>Stripe</strong></td><td>Payment processing (Stripe Connect)</td><td>Artist payout details, fan payment data. Card data goes directly to Stripe</td></tr>
            <tr><td><strong>Resend</strong></td><td>Transactional and marketing email</td><td>Email addresses, names</td></tr>
            <tr><td><strong>Cloudflare</strong></td><td>Hosting, CDN, DNS, DDoS protection</td><td>IP addresses, request metadata</td></tr>
          </tbody></table>
          <p>We do not sell your personal data to anyone. We do not share data with advertisers. We do not use third-party tracking pixels or advertising networks.</p>

          <h2>6. International data transfers</h2>
          <p>Some of our processors may process data outside the UK. Where this occurs, we ensure appropriate safeguards are in place:</p>
          <ul>
            <li>UK adequacy decisions for the destination country, or</li>
            <li>Standard Contractual Clauses (SCCs) approved by the ICO, or</li>
            <li>The processor&apos;s binding corporate rules</li>
          </ul>

          <h2>7. Your rights</h2>
          <p>Under UK GDPR, you have the following rights. To exercise any of them, email <a href="mailto:privacy@getinsound.com">privacy@getinsound.com</a>. We will respond within 30 days.</p>
          <ul>
            <li><strong>Right of access</strong> (Art. 15) &mdash; Request a copy of all personal data we hold about you.</li>
            <li><strong>Right to rectification</strong> (Art. 16) &mdash; Ask us to correct inaccurate data.</li>
            <li><strong>Right to erasure</strong> (Art. 17) &mdash; Ask us to delete your data (&ldquo;right to be forgotten&rdquo;).</li>
            <li><strong>Right to restrict processing</strong> (Art. 18) &mdash; Ask us to limit how we use your data while a dispute is resolved.</li>
            <li><strong>Right to data portability</strong> (Art. 20) &mdash; Request your data in a structured, machine-readable format (JSON or CSV).</li>
            <li><strong>Right to object</strong> (Art. 21) &mdash; Object to processing based on legitimate interest.</li>
            <li><strong>Right to withdraw consent</strong> &mdash; Withdraw consent for marketing at any time via unsubscribe links or by contacting us.</li>
          </ul>
          <p>We do not carry out automated decision-making or profiling that produces legal effects.</p>

          <h2>8. Cookies &amp; local storage</h2>
          <p>Insound does not use traditional tracking cookies. Here is what we do use:</p>
          <h3>8.1 localStorage (browser)</h3>
          <table><thead><tr><th>Key</th><th>Purpose</th><th>Duration</th></tr></thead><tbody>
            <tr><td><code>insound_view_mode</code></td><td>Remembers your compact/expanded view preference</td><td>Persistent until cleared</td></tr>
          </tbody></table>
          <p>localStorage values are stored entirely in your browser. They are not sent to our servers, not shared with third parties, and can be cleared at any time via your browser settings.</p>
          <h3>8.2 Supabase authentication</h3>
          <p>When you create an account, Supabase stores authentication tokens in localStorage to maintain your session. Strictly necessary for the platform to function.</p>
          <h3>8.3 Stripe</h3>
          <p>Stripe may set cookies on its own domain during checkout. These are governed by <a href="https://stripe.com/gb/cookie-settings" target="_blank" rel="noopener">Stripe&apos;s cookie policy</a> and are strictly necessary for payment security.</p>
          <h3>8.4 Cloudflare</h3>
          <p>Cloudflare may set a <code>__cf_bm</code> cookie for bot detection. This is a strictly necessary security cookie exempt from consent requirements under UK PECR.</p>
          <p>We do not use Google Analytics, Facebook Pixel, or any third-party advertising or tracking technology.</p>

          <h2>9. Children&apos;s privacy</h2>
          <p>Insound is not directed at children under 13. We do not knowingly collect personal data from anyone under 13. If you believe a child has provided us with personal data, please contact us and we will delete it promptly.</p>

          <h2>10. Changes to this policy</h2>
          <p>If we make material changes to this policy, we will:</p>
          <ul>
            <li>Update the &ldquo;last updated&rdquo; date at the top of this page</li>
            <li>Notify existing users by email where the change affects how their data is processed</li>
            <li>Not retroactively reduce your rights without explicit consent</li>
          </ul>

          <h2>11. How to contact us or complain</h2>
          <p>If you have questions about this policy or want to exercise your rights:</p>
          <p><strong>Email:</strong> <a href="mailto:privacy@getinsound.com">privacy@getinsound.com</a></p>
          <p>If you are not satisfied with our response, you have the right to lodge a complaint with the Information Commissioner&apos;s Office (ICO):</p>
          <table><tbody>
            <tr><td><strong>Website</strong></td><td><a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener">ico.org.uk/make-a-complaint</a></td></tr>
            <tr><td><strong>Helpline</strong></td><td>0303 123 1113</td></tr>
            <tr><td><strong>Post</strong></td><td>Information Commissioner&apos;s Office, Wycliffe House, Water Lane, Wilmslow, Cheshire, SK9 5AF</td></tr>
          </tbody></table>
        </div>
      </div>

      <footer className="border-t border-zinc-900/80 py-16">
        <div className="max-w-4xl mx-auto px-6 flex flex-col items-center gap-6">
          <Image src="/insound_logo_orange.svg" alt="insound." width={80} height={32} className="h-8 w-auto" />
          <div className="flex flex-wrap justify-center gap-6 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
            <Link href="/" className="hover:text-orange-500 transition-colors">Home</Link>
            <Link href="/for-artists" className="hover:text-orange-500 transition-colors">Artists</Link>
            <Link href="/for-fans" className="hover:text-orange-500 transition-colors">Fans</Link>
            <Link href="/for-press" className="hover:text-orange-500 transition-colors">Press</Link>
            <Link href="/privacy" className="text-orange-500">Privacy</Link>
            <Link href="/terms" className="hover:text-orange-500 transition-colors">Terms</Link>
            <Link href="/ai-policy" className="hover:text-orange-500 transition-colors">AI Policy</Link>
          </div>
          <p className="text-zinc-700 text-[11px] font-medium">&copy; 2026 Insound</p>
        </div>
      </footer>
    </main>
  )
}
