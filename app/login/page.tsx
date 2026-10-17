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
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
  }

  return (
    <main className="min-h-dvh bg-ink text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-3xl font-bold">Welcome Back</h1>
        <p className="text-mute">Log in to your Conexxa account.</p>
        <input type="email" placeholder="your@university.edu" value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full bg-panel border border-line rounded-xl p-3 text-white"
        />
        <input type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full bg-panel border border-line rounded-xl p-3 text-white"
        />
        {error && <p className="text-flame">{error}</p>}
        <button onClick={handleLogin}
          className="w-full btn-flame py-3 rounded-full font-semibold transition">
          {loading ? 'Logging in...' : 'Log In'}
        </button>
        <p className="text-center text-mute">
          Don't have an account?{' '}
          <Link href="/signup" className="text-ember hover:underline">Sign Up</Link>
        </p>
        <p className="text-center text-mute">
          <Link href="/forgot-password" className="text-ember hover:underline">Forgot password?</Link>
        </p>
      </div>
    </main>
  )
}