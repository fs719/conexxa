'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Verify() {
  const router = useRouter()

  useEffect(() => {
    const handleAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/dashboard')
      } else {
        router.push('/')
      }
    }
    handleAuth()
  }, [])

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#a094ab" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3.5 7l8.5 6 8.5-6" /></svg>
        <h1 className="text-3xl font-bold">Check Your Email</h1>
        <p className="text-gray-400">
          We sent a verification link to your .edu email. 
          Click it to confirm your account then come back to log in.
        </p>
        <button onClick={() => router.push('/login')}
          className="w-full btn-flame py-3 rounded-full font-semibold transition">
          Go to Login
        </button>
      </div>
    </main>
  )
}