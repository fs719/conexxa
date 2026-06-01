'use client'
import { useRouter } from 'next/navigation'

export default function Verify() {
  const router = useRouter()
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="text-6xl">📧</div>
        <h1 className="text-3xl font-bold">Check Your Email</h1>
        <p className="text-gray-400">
          We sent a verification link to your .edu email. 
          Click it to confirm your account then come back to log in.
        </p>
        <button onClick={() => router.push('/login')}
          className="w-full bg-rose-500 hover:bg-rose-600 py-3 rounded-full font-semibold transition">
          Go to Login
        </button>
      </div>
    </main>
  )
}