'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
    }
    getUser()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Conexxa</h1>
          <button onClick={handleSignOut} className="text-gray-400 hover:text-white transition">
            Sign Out
          </button>
        </div>
        <p className="text-gray-400">Welcome back! Start swiping to find your match.</p>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => router.push('/swipe')}
            className="bg-rose-500 hover:bg-rose-600 py-6 rounded-2xl font-semibold text-lg transition">
            💘 Swipe
          </button>
          <button onClick={() => router.push('/matches')}
            className="bg-gray-900 hover:bg-gray-800 py-6 rounded-2xl font-semibold text-lg transition">
            💬 Matches
          </button>
        </div>
      </div>
    </main>
  )
}