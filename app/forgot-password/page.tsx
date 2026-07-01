'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ForgotPassword() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleReset = async () => {
    if (!email.endsWith('.edu')) { setError('Please use your .edu email.'); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://conexxa-one.vercel.app/reset-password',
    })
    if (error) { setError(error.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  if (sent) return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="text-6xl">📧</div>
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="text-gray-400">We sent a password reset link to {email}</p>
        <button onClick={() => router.push('/login')}
          className="bg-rose-500 hover:bg-rose-600 px-8 py-3 rounded-full font-semibold transition">
          Back to Login
        </button>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-3xl font-bold">Forgot Password</h1>
        <p className="text-gray-400">Enter your .edu email and we'll send a reset link.</p>
        <input type="email" placeholder="your@university.edu" value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
        />
        {error && <p className="text-red-500">{error}</p>}
        <button onClick={handleReset}
          className="w-full bg-rose-500 hover:bg-rose-600 py-3 rounded-full font-semibold transition">
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
        <button onClick={() => router.push('/login')} className="w-full text-gray-500 hover:text-white transition">
          Back to Login
        </button>
      </div>
    </main>
  )
}