import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-6 text-center">
      <h1 className="text-5xl font-bold mb-4">Conexxa</h1>
      <p className="text-gray-400 text-lg mb-2">Find your match. Unlock the conversation.</p>
      <p className="text-gray-500 text-sm mb-8">For college students. Verified with your .edu email.</p>
      <div className="flex gap-4">
        <Link href="/signup" className="bg-rose-500 hover:bg-rose-600 text-white px-8 py-3 rounded-full font-semibold transition">
          Get Started
        </Link>
        <Link href="/login" className="border border-white hover:bg-white hover:text-black text-white px-8 py-3 rounded-full font-semibold transition">
          Log In
        </Link>
      </div>
      <div className="mt-10 text-xs text-gray-600 space-x-4">
        <Link href="/terms" className="hover:text-gray-400">Terms</Link>
        <Link href="/privacy" className="hover:text-gray-400">Privacy</Link>
      </div>
    </main>
  )
}
