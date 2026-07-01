'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleReset = async () => {
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true)
    setLoading(false)
  }

  if (done) return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="text-6xl">✅</div>
        <h1 className="text-2xl font-bold">Password updated!</h1>
        <button onClick={() => router.push('/dashboard')}
          className="bg-rose-500 hover:bg-rose-600 px-8 py-3 rounded-full font-semibold transition">
          Go to Dashboard
        </button>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-3xl font-bold">Reset Password</h1>
        <input type="password" placeholder="New password" value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
        />
        {error && <p className="text-red-500">{error}</p>}
        <button onClick={handleReset}
          className="w-full bg-rose-500 hover:bg-rose-600 py-3 rounded-full font-semibold transition">
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </div>
    </main>
  )
}