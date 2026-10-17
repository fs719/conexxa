import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-dvh bg-ink text-white flex flex-col px-6">
      <div className="flex-1 w-full max-w-md mx-auto flex flex-col justify-center py-16">
        <p className="font-display text-xl font-bold mb-10">Conexxa</p>
        <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.02]">Match first.<br />Then talk.</h1>
        <p className="text-mute text-lg mt-6 leading-snug">
          Like someone. If they like you back, you both answer one question and the chat opens. Matches last 24 hours.
        </p>
        <div className="mt-10 space-y-3">
          <Link href="/signup" className="block text-center btn-flame py-4 rounded-full font-semibold text-lg">Create account</Link>
          <Link href="/login" className="block text-center py-4 rounded-full font-semibold text-lg border border-line hover:border-white/30 transition">Log in</Link>
        </div>
        <p className="text-sm text-mute mt-6">For college students. You'll verify with your .edu email.</p>
      </div>
      <footer className="w-full max-w-md mx-auto py-6 text-xs text-mute flex gap-5">
        <Link href="/terms" className="hover:text-white">Terms</Link>
        <Link href="/privacy" className="hover:text-white">Privacy</Link>
      </footer>
    </main>
  )
}
