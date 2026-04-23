import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

export const runtime = 'edge'
export const metadata: Metadata = {
  title: 'AI Content Policy | Insound',
  description: "Insound's policy on AI-generated content. What's permitted, what isn't, and why.",
}

export default function AiPolicyPage() {
  return (
    <main className="bg-[#0A0A0A] text-white min-h-screen">
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div id="navInner" className="mx-4 mt-4 px-5 py-3 rounded-2xl ring-1 ring-white/[0.05] flex items-center justify-between" style={{ background: 'rgba(5,5,5,0.75)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
          <Link href="/" className="font-display text-lg font-bold">insound<span className="text-orange-500">.</span></Link>
          <Link href="/" className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">&larr; Home</Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 pt-36 pb-24">
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] mb-3">AI Content Policy</h1>
        <p className="text-zinc-500 text-sm mb-16">Last updated: April 2026</p>

        <div className="space-y-6 text-[15px] text-zinc-400 leading-[1.75] [&_h2]:font-display [&_h2]:text-[1.35rem] [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-12 [&_h2]:mb-3 [&_h3]:font-display [&_h3]:text-[1.05rem] [&_h3]:font-bold [&_h3]:text-white [&_h3]:mt-6 [&_h3]:mb-2 [&_a]:text-orange-600 [&_a:hover]:text-orange-400 [&_strong]:text-white [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1.5">

          <p>Insound exists for human artists making real music. That&apos;s the whole point. This policy explains where we draw the line on AI-generated content, and why.</p>

          <p>We&apos;re not anti-technology. Artists have always used tools &mdash; samplers, drum machines, auto-tune, algorithmic reverbs. We&apos;re not going to pretend a compressor plugin is fundamentally different because it has a neural network in it. But there is a line between a tool that helps an artist make their work and a system that replaces the artist entirely. This policy is about that line.</p>

          <h2>1. What&apos;s permitted</h2>

          <h3>AI-assisted production tools &mdash; <span className="text-emerald-500 font-bold">Yes</span></h3>
          <p>Mastering services, mixing assistants, noise reduction, stem separation, EQ matching, intelligent compression, pitch correction &mdash; all fine. These are production tools. You&apos;re still the one making the music. If a human wrote it, performed it, and is responsible for the creative decisions, the tools you used to polish it are your business.</p>

          <h3>AI-assisted composition aids &mdash; <span className="text-emerald-500 font-bold">Yes</span></h3>
          <p>Using AI to generate chord suggestions, melodic ideas, or arrangement sketches that you then develop, rewrite, and make your own is permitted. The key word is <em>assist</em>. If you used it as a starting point and the final work is yours, that&apos;s fine.</p>

          <h3>AI-generated cover art &mdash; <span className="text-yellow-500 font-bold">Permitted with disclosure</span></h3>
          <p>We know not every independent artist can afford a designer. If you use AI to generate or substantially create your cover artwork, tag it as AI-generated when you upload. We&apos;ll display a small disclosure on the release page. No penalty, no judgement &mdash; just transparency.</p>

          <h2>2. What&apos;s not permitted</h2>

          <h3>Fully AI-generated tracks &mdash; <span className="text-red-500 font-bold">No</span></h3>
          <p>If the composition, arrangement, and performance were generated entirely by AI &mdash; with no meaningful human creative input beyond a text prompt or parameter adjustment &mdash; it doesn&apos;t belong on Insound. This platform is for artists. A prompt is not a performance.</p>

          <h3>AI-generated vocals &mdash; <span className="text-red-500 font-bold">No</span></h3>
          <p>Synthetic voices, AI voice clones, and text-to-speech vocals are not permitted, whether they imitate a real person or not. The voice is the artist. If the vocal on the track isn&apos;t a human being singing or speaking, it doesn&apos;t meet our standard. This applies even if the underlying composition is entirely human-made.</p>
          <p>Vocoder effects, pitch correction, and vocal processing are fine &mdash; those are applied to a real human vocal. The distinction is: did a person actually sing it?</p>

          <h3>AI-cloned reproductions of other artists &mdash; <span className="text-red-500 font-bold">No</span></h3>
          <p>Using AI to replicate another artist&apos;s voice, style, or likeness &mdash; whether they&apos;re on Insound or not &mdash; is not permitted. This isn&apos;t just a policy issue, it&apos;s an integrity one.</p>

          <h2>3. The grey area</h2>

          <p>We know this isn&apos;t always black and white. A track might use AI-generated backing elements with human vocals and human-written lyrics. A producer might use AI to generate a drum pattern, then chop and rearrange it beyond recognition.</p>

          <p>Our standard is: <strong>a human artist must be responsible for the substantive creative decisions in the work.</strong> If you could remove the AI-generated elements and the track would lose its identity, that&apos;s a problem. If the AI contributed raw material that you shaped into something that&apos;s genuinely yours, that&apos;s probably fine.</p>

          <p>If you&apos;re unsure, email <a href="mailto:dan@getinsound.com">dan@getinsound.com</a> before you upload. We&apos;d rather have the conversation upfront than take something down later.</p>

          <h2>4. How we handle violations</h2>

          <p>We don&apos;t use automated AI-detection tools. They&apos;re unreliable, they produce false positives against legitimate artists, and we don&apos;t think an algorithm should be making these calls. All reviews are done by a human.</p>

          <p>The process:</p>
          <ul>
            <li><strong>Report.</strong> Anyone can flag a release by emailing <a href="mailto:dan@getinsound.com">dan@getinsound.com</a> with the release URL and the concern.</li>
            <li><strong>Review.</strong> We review the report and the release. If we need more context, we&apos;ll contact the artist directly.</li>
            <li><strong>Decision.</strong> If the release clearly violates this policy, we&apos;ll take it down and notify the artist with an explanation. If it&apos;s borderline, we&apos;ll work with the artist to resolve it &mdash; editing metadata, adding disclosure, or in some cases, removing the release.</li>
            <li><strong>Appeal.</strong> Artists can respond to any takedown decision by replying to the notification email. We&apos;ll re-review with any additional context provided.</li>
          </ul>

          <p>First violations are handled as takedowns with notice, not account bans. Repeated or deliberate violations &mdash; uploading entirely AI-generated catalogues while claiming them as original work, for example &mdash; may result in account removal.</p>

          <h2>5. Why this matters</h2>

          <p>Insound is for independent and unsigned artists. The people who sign up here are putting real work into their music &mdash; writing, recording, performing, producing. The value of this platform depends on that being true for everyone on it.</p>

          <p>If we allow fully AI-generated content alongside human-made music without distinction, we devalue the work of every artist here. We&apos;re not going to do that.</p>

          <p>This policy will evolve as the technology does. When it changes, we&apos;ll update this page and notify artists by email. We won&apos;t retroactively apply stricter rules to existing uploads without notice.</p>

          <h2>6. Contact</h2>
          <p>Questions about this policy, or unsure whether your release qualifies: <a href="mailto:dan@getinsound.com">dan@getinsound.com</a></p>
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
            <Link href="/privacy" className="hover:text-orange-500 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-orange-500 transition-colors">Terms</Link>
            <Link href="/ai-policy" className="text-orange-500">AI Policy</Link>
          </div>
          <p className="text-zinc-700 text-[11px] font-medium">&copy; 2026 Insound</p>
        </div>
      </footer>
    </main>
  )
}
