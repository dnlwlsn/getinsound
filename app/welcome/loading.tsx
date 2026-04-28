export default function WelcomeLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        <div className="w-24 h-8 bg-zinc-900 rounded animate-pulse mx-auto mb-8" />
        <div className="w-48 h-6 bg-zinc-900 rounded animate-pulse mx-auto mb-4" />
        <div className="w-64 h-4 bg-zinc-900 rounded animate-pulse mx-auto mb-8" />
        <div className="h-12 bg-zinc-900 rounded-xl animate-pulse" />
      </div>
    </div>
  )
}
