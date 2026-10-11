'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [pending, setPending] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: prof } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle()
      if (!prof?.name) { router.push('/signup'); return }
      const { data: ms } = await supabase.from('matches').select('user1_answer,user2_answer,user1_id,expires_at,chat_unlocked')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      setPending((ms || []).filter((m: any) => !m.chat_unlocked && new Date(m.expires_at) > new Date()).length)
    }
    getUser()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const invite = async () => {
    const url = 'https://conexxa.net'
    const text = 'Join me on Conexxa, the dating app for college students.'
    try {
      if (navigator.share) { await navigator.share({ title: 'Conexxa', text, url }); return }
      await navigator.clipboard.writeText(`${text} ${url}`)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch {}
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
            💬 Matches{pending > 0 && <span className="ml-2 bg-rose-500 text-white text-sm px-2 py-0.5 rounded-full">{pending}</span>}
          </button>
        </div>
        <button onClick={() => router.push('/settings')}
          className="w-full bg-gray-900 hover:bg-gray-800 py-4 rounded-2xl font-semibold transition">
          ⚙️ Edit Profile
        </button>
        <button onClick={invite}
          className="w-full border border-gray-700 hover:border-rose-500 py-4 rounded-2xl font-semibold transition">
          {copied ? 'Link copied!' : '📣 Invite friends'}
        </button>
      </div>
    </main>
  )
}