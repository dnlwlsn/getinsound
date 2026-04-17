import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-4">404</p>
        <h1 className="text-3xl font-black mb-3 font-display">Page not found.</h1>
        <p className="text-zinc-500 font-medium mb-8">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link href="/" className="inline-block bg-orange-600 hover:bg-orange-500 text-black font-black px-6 py-3 rounded-xl text-sm transition-colors">
          Back to Home
        </Link>
      </div>
    </div>
  )
}
