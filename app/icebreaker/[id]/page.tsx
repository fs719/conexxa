'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function Icebreaker() {
  const router = useRouter()
  const { id } = useParams()
  const [match, setMatch] = useState<any>(null)
  const [answer, setAnswer] = useState('')
  const [userId, setUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: matchData } = await supabase
        .from('matches')
        .select('*')
        .eq('id', id)
        .single()

      setMatch(matchData)
      setLoading(false)
    }
    init()
  }, [])

  const handleSubmit = async () => {
    if (!answer.trim()) return
    const isUser1 = match.user1_id === userId
    const field = isUser1 ? 'user1_answer' : 'user2_answer'
    const otherField = isUser1 ? 'user2_answer' : 'user1_answer'

    await supabase.from('matches').update({ [field]: answer }).eq('id', id)

    const { data: updated } = await supabase
      .from('matches')
      .select('*')
      .eq('id', id)
      .single()

    if (updated[otherField]) {
      await supabase.from('matches').update({ chat_unlocked: true }).eq('id', id)
      router.push(`/chat/${id}`)
    } else {
      setSubmitted(true)
    }
  }

  if (loading) return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <p>Loading...</p>
    </main>
  )

  if (submitted) return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="text-6xl">⏳</div>
        <h1 className="text-2xl font-bold">Answer submitted!</h1>
        <p className="text-gray-400">Waiting for your match to answer. Chat unlocks when both answer.</p>
        <button onClick={() => router.push('/matches')}
          className="bg-rose-500 hover:bg-rose-600 px-8 py-3 rounded-full font-semibold transition">
          Back to Matches
        </button>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/matches')} className="text-gray-400 hover:text-white">← Back</button>
          <h1 className="text-2xl font-bold">Icebreaker</h1>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 space-y-4">
          <p className="text-gray-400 text-sm">Answer this to unlock your chat:</p>
          <p className="text-xl font-semibold">{match?.icebreaker_prompt}</p>
        </div>

        <textarea
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          placeholder="Type your answer..."
          maxLength={200}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white h-32 resize-none"
        />

        <button onClick={handleSubmit}
          className="w-full bg-rose-500 hover:bg-rose-600 py-3 rounded-full font-semibold transition">
          Submit Answer
        </button>
      </div>
    </main>
  )
}