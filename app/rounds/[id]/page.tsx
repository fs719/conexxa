'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { ROUNDS } from '@/lib/rounds'

const round = ROUNDS[0]
type Status = { iDone: boolean; theyDone: boolean; both: { mine: number[]; theirs: number[] } | null }

export default function VibeCheck() {
  const router = useRouter()
  const { id } = useParams()
  const [token, setToken] = useState('')
  const [name, setName] = useState('them')
  const [st, setSt] = useState<Status | null>(null)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [revealed, setRevealed] = useState(false)
  const [shown, setShown] = useState(0)
  const [error, setError] = useState('')

  const headers = (t = token) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` })
  const refresh = async (t = token) => {
    const r = await fetch(`/api/round?matchId=${id}`, { headers: headers(t) })
    if (r.ok) setSt((await r.json()).rounds[0])
  }

  useEffect(() => {
    let timer: any
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setToken(session.access_token)
      const { data: m } = await supabase.from('matches').select('*').eq('id', id).single()
      if (!m || !m.chat_unlocked) { router.push('/matches'); return }
      const otherId = m.user1_id === session.user.id ? m.user2_id : m.user1_id
      const { data: p } = await supabase.from('profiles').select('name').eq('id', otherId).single()
      if (p?.name) setName(p.name)
      await refresh(session.access_token)
      timer = setInterval(() => refresh(session.access_token), 3000)
    })()
    return () => clearInterval(timer)
  }, [])

  const pick = async (idx: number) => {
    const next = [...answers, idx]
    if (next.length < round.qs.length) { setAnswers(next); setStep(step + 1); return }
    setAnswers(next)
    const r = await fetch('/api/round', { method: 'POST', headers: headers(), body: JSON.stringify({ matchId: id, level: 1, answers: next }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setError(d.error || 'Something went wrong.'); setAnswers([]); setStep(0); return }
    setSt(d.rounds[0])
  }

  const score = st?.both ? Math.round((round.qs.filter((_, i) => st.both!.mine[i] === st.both!.theirs[i]).length / round.qs.length) * 100) : 0

  useEffect(() => {
    if (!revealed) return
    let n = 0
    const t = setInterval(() => { n += 4; if (n >= score) { n = score; clearInterval(t) } setShown(n) }, 25)
    return () => clearInterval(t)
  }, [revealed, score])

  if (!st) return <main className="min-h-dvh bg-ink flex items-center justify-center text-mute">Loading...</main>

  // 1. Answering
  if (!st.iDone) {
    const q = round.qs[step]
    return (
      <main className="min-h-dvh bg-ink text-white p-6">
        <div className="max-w-md mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={() => router.push(`/chat/${id}`)} className="text-mute hover:text-white">← Back</button>
            <p className="text-mute text-sm">{step + 1} of {round.qs.length}</p>
          </div>
          <div className="h-1.5 rounded-full bg-raised overflow-hidden"><div className="h-full btn-flame transition-all" style={{ width: `${(step / round.qs.length) * 100}%` }} /></div>
          <h1 className="text-3xl font-bold leading-tight pt-4">{q.q}</h1>
          <div className="space-y-3">
            {q.options.map((o, i) => (
              <button key={o} onClick={() => pick(i)} className="w-full text-left px-5 py-4 rounded-2xl bg-panel border border-line hover:border-white/40 active:scale-[0.99] transition text-lg">{o}</button>
            ))}
          </div>
          {error && <p className="text-flame">{error}</p>}
        </div>
      </main>
    )
  }

  // 2. Waiting
  if (!st.both) return (
    <main className="min-h-dvh bg-ink text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-5">
        <h1 className="text-3xl font-bold">Locked in</h1>
        <p className="text-mute">Waiting for {name}. Your score shows up here the second they finish.</p>
        <button onClick={() => router.push(`/chat/${id}`)} className="btn-flame px-8 py-3 rounded-full font-semibold">Back to chat</button>
      </div>
    </main>
  )

  // 3. Reveal
  const same = round.qs.map((_, i) => st.both!.mine[i] === st.both!.theirs[i])
  if (!revealed) return (
    <main className="min-h-dvh bg-ink text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-6">
        <h1 className="text-3xl font-bold">You both finished</h1>
        <p className="text-mute">Ready to see how you match with {name}?</p>
        <button onClick={() => setRevealed(true)} className="w-full btn-flame py-5 rounded-full font-bold text-xl">Reveal</button>
      </div>
    </main>
  )

  return (
    <main className="min-h-dvh bg-ink text-white p-6">
      <div className="max-w-md mx-auto space-y-6 pt-6">
        <div className="text-center">
          <p className="text-8xl font-extrabold bg-clip-text text-transparent tabular-nums" style={{ backgroundImage: 'linear-gradient(135deg,#ff4d6d,#ff8a5b)' }}>{shown}%</p>
          <p className="text-mute mt-1">match with {name}</p>
        </div>
        <div className="space-y-2">
          {round.qs.map((q, i) => (
            <div key={q.q} className="rounded-2xl bg-panel border border-line px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-mute">{q.q}</p>
                <p className="truncate">{q.options[st.both!.mine[i]]} <span className="text-mute">/</span> {q.options[st.both!.theirs[i]]}</p>
              </div>
              {same[i] && <span className="text-ok text-sm font-semibold shrink-0">Same</span>}
            </div>
          ))}
        </div>
        <button onClick={() => router.push(`/chat/${id}?swap=1`)} className="w-full btn-flame py-4 rounded-full font-bold text-lg">Swap Instagram</button>
        <button onClick={() => router.push(`/chat/${id}`)} className="w-full text-mute hover:text-white py-2">Back to chat</button>
      </div>
    </main>
  )
}
