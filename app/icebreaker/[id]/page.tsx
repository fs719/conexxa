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

  if (loading) return <main className="min-h-dvh bg-ink flex items-center justify-center text-mute">Loading...</main>

  if (submitted) return (
    <main className="min-h-dvh bg-ink text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-5">
        <h1 className="text-3xl font-bold">You're in</h1>
        <p className="text-mute">Waiting for them to answer. This page opens the chat the moment they do.</p>
        <button onClick={() => router.push('/matches')} className="btn-flame px-8 py-3 rounded-full font-semibold">Back to matches</button>
      </div>
    </main>
  )

  return (
    <main className="min-h-dvh bg-ink text-white p-6">
      <div className="w-full max-w-md mx-auto space-y-6">
        <button onClick={() => router.push('/matches')} className="text-mute hover:text-white">← Back</button>
        <div className="space-y-2">
          <p className="text-mute text-sm">Pick one. Chat opens when you both have.</p>
          <h1 className="text-3xl font-bold leading-tight">{match?.icebreaker_prompt}</h1>
        </div>
        <div className="space-y-3">
          {optionsFor(match?.icebreaker_prompt).map(o => (
            <button key={o} onClick={() => setChoice(o)}
              className={`w-full text-left px-5 py-4 rounded-2xl border text-lg transition ${choice === o ? 'btn-flame border-transparent' : 'bg-panel border-line hover:border-white/30'}`}>
              {o}
            </button>
          ))}
        </div>
        {error && <p className="text-flame">{error}</p>}
        <button disabled={!choice || saving} onClick={handleSubmit} className="w-full btn-flame py-4 rounded-full font-semibold text-lg">
          {saving ? 'Saving...' : 'Lock in my answer'}
        </button>
      </div>
    </main>
  )
}
