'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-3xl font-bold">Welcome Back</h1>
        <p className="text-gray-400">Log in to your Conexxa account.</p>
        <input type="email" placeholder="your@university.edu" value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
        />
        <input type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
        />
        {error && <p className="text-red-500">{error}</p>}
        <button onClick={handleLogin}
          className="w-full bg-rose-500 hover:bg-rose-600 py-3 rounded-full font-semibold transition">
          {loading ? 'Logging in...' : 'Log In'}
        </button>
        <p className="text-center text-gray-400">
          Don't have an account?{' '}
          <Link href="/signup" className="text-rose-500 hover:underline">Sign Up</Link>
        </p>
      </div>
    </main>
  )
}