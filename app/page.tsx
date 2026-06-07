import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
      <h1 className="text-5xl font-bold mb-4">Conexxa</h1>
      <p className="text-gray-400 text-lg mb-8">Find your match. Unlock the conversation.</p>
      <div className="flex gap-4">
        <Link href="/signup" className="bg-rose-500 hover:bg-rose-600 text-white px-8 py-3 rounded-full font-semibold transition">
          Get Started
        </Link>
        <Link href="/login" className="border border-white hover:bg-white hover:text-black text-white px-8 py-3 rounded-full font-semibold transition">
          Log In
        </Link>
      </div>
    </main>
  )
}