'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ForgotPassword() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const post = async (url: string, body: object) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { ok: res.ok, data: await res.json().catch(() => ({})) }
  }

  const sendCode = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[a-z]+$/i.test(email.trim())) { setError('Please use your .edu email.'); return }
    setLoading(true)
    const { ok, data } = await post('/api/auth/send-code', { email, purpose: 'reset' })
    setLoading(false)
    if (!ok) { setError(data.error || 'Could not send code.'); return }
    setError(''); setCodeSent(true)
  }

  const reset = async () => {
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    const { ok, data } = await post('/api/auth/verify-code', { email, purpose: 'reset', code, password })
    if (!ok) { setError(data.error || 'Invalid code.'); setLoading(false); return }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    setLoading(false)
    if (error) { router.push('/login'); return }
    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-3xl font-bold">Forgot Password</h1>
        {!codeSent ? (
          <>
            <p className="text-gray-400">Enter your .edu email and we'll send a 6-digit code.</p>
            <input type="email" placeholder="your@university.edu" value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white" />
            {error && <p className="text-red-500">{error}</p>}
            <button disabled={loading} onClick={sendCode}
              className="w-full bg-rose-500 hover:bg-rose-600 py-3 rounded-full font-semibold transition">
              {loading ? 'Sending...' : 'Send Code'}
            </button>
          </>
        ) : (
          <>
            <p className="text-gray-400">If {email} has an account, a code is on its way. Check spam too.</p>
            <input type="text" inputMode="numeric" maxLength={6} placeholder="123456" value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white text-center text-2xl tracking-widest" />
            <input type="password" placeholder="New password" value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white" />
            {error && <p className="text-red-500">{error}</p>}
            <button disabled={loading || code.length !== 6} onClick={reset}
              className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 py-3 rounded-full font-semibold transition">
              {loading ? 'Updating...' : 'Update Password'}
            </button>
            <button onClick={sendCode} className="w-full text-gray-500 hover:text-white transition">Resend code</button>
          </>
        )}
        <button onClick={() => router.push('/login')} className="w-full text-gray-500 hover:text-white transition">
          Back to Login
        </button>
      </div>
    </main>
  )
}
