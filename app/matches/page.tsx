'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Matches() {
  const router = useRouter()
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: matchData } = await supabase
        .from('matches')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (matchData) {
        const enriched = await Promise.all(matchData.map(async (match) => {
          const otherId = match.user1_id === user.id ? match.user2_id : match.user1_id
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, photo_url')
            .eq('id', otherId)
            .single()
          return { ...match, otherProfile: profile }
        }))
        setMatches(enriched)
      }
      setLoading(false)
    }
    init()
  }, [])

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date()

  if (loading) return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <p>Loading matches...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white">← Back</button>
          <h1 className="text-2xl font-bold">Your Matches</h1>
        </div>

        {matches.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <div className="text-6xl">💘</div>
            <p className="text-gray-400">No matches yet. Keep swiping!</p>
            <button onClick={() => router.push('/swipe')}
              className="bg-rose-500 hover:bg-rose-600 px-8 py-3 rounded-full font-semibold transition">
              Start Swiping
            </button>
          </div>
        )}

        {matches.map(match => (
          <div key={match.id} className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-2xl">
                {match.otherProfile?.photo_url ? (
                  <img src={match.otherProfile.photo_url} className="w-full h-full object-cover rounded-full" />
                ) : '👤'}
              </div>
              <div>
                <h2 className="font-bold">{match.otherProfile?.name || 'Unknown'}</h2>
                {isExpired(match.expires_at) && !match.chat_unlocked ? (
                  <p className="text-red-400 text-sm">Expired</p>
                ) : match.chat_unlocked ? (
                  <p className="text-green-400 text-sm">Chat unlocked ✓</p>
                ) : (
                  <p className="text-yellow-400 text-sm">Answer icebreaker to unlock chat</p>
                )}
              </div>
            </div>

            {!match.chat_unlocked && !isExpired(match.expires_at) && (
              <div className="bg-gray-800 rounded-xl p-3 space-y-2">
                <p className="text-sm text-gray-400">Icebreaker:</p>
                <p className="text-white">{match.icebreaker_prompt}</p>
                <button onClick={() => router.push(`/icebreaker/${match.id}`)}
                  className="w-full bg-rose-500 hover:bg-rose-600 py-2 rounded-xl text-sm font-semibold transition">
                  Answer Now
                </button>
              </div>
            )}

            {match.chat_unlocked && (
              <button onClick={() => router.push(`/chat/${match.id}`)}
                className="w-full bg-gray-800 hover:bg-gray-700 py-2 rounded-xl text-sm font-semibold transition">
                Open Chat →
              </button>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}