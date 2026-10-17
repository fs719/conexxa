'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { parseTs } from '@/lib/time'
import { optionsFor } from '@/lib/icebreakers'
import { useRouter, useParams } from 'next/navigation'

export default function Icebreaker() {
  const router = useRouter()
  const { id } = useParams()
  const [match, setMatch] = useState<any>(null)
  const [choice, setChoice] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: m } = await supabase.from('matches').select('*').eq('id', id).single()
      if (!m) { router.push('/matches'); return }
      if (m.chat_unlocked) { router.push(`/chat/${id}`); return }
      if (parseTs(m.expires_at) < new Date()) { router.push('/matches'); return }
      const mine = m.user1_id === user.id ? m.user1_answer : m.user2_answer
      if (mine) setSubmitted(true)
      setMatch(m)
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (!submitted) return
    const t = setInterval(async () => {
      const { data: m } = await supabase.from('matches').select('chat_unlocked').eq('id', id).single()
      if (m?.chat_unlocked) router.push(`/chat/${id}`)
    }, 4000)
    return () => clearInterval(t)
  }, [submitted])

  const handleSubmit = async () => {
    if (!choice) return
    setSaving(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/icebreaker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ matchId: id, answer: choice }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Something went wrong.'); return }
    if (data.unlocked) router.push(`/chat/${id}`)
    else setSubmitted(true)
  }

  if (loading) return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center"><p>Loading...</p></main>
  )

  if (submitted) return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="text-6xl">⏳</div>
        <h1 className="text-2xl font-bold">Answer submitted!</h1>
        <p className="text-gray-400">Waiting for your match to answer. Chat unlocks when you both have.</p>
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
        <div className="bg-gray-900 rounded-2xl p-6 space-y-2">
          <p className="text-gray-400 text-sm">Pick one to unlock your chat:</p>
          <p className="text-xl font-semibold">{match?.icebreaker_prompt}</p>
        </div>
        <div className="space-y-3">
          {optionsFor(match?.icebreaker_prompt).map(o => (
            <button key={o} onClick={() => setChoice(o)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition ${choice === o ? 'bg-rose-500 border-rose-500' : 'border-gray-700 hover:border-rose-500'}`}>
              {o}
            </button>
          ))}
        </div>
        {error && <p className="text-red-500">{error}</p>}
        <button disabled={!choice || saving} onClick={handleSubmit}
          className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 py-3 rounded-full font-semibold transition">
          {saving ? 'Saving...' : 'Submit'}
        </button>
      </div>
    </main>
  )
}
