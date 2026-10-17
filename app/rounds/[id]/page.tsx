'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { ROUNDS } from '@/lib/rounds'

type Status = { level: number; unlocked: boolean; iDone: boolean; theyDone: boolean; both: { mine: number[]; theirs: number[] } | null }

export default function Rounds() {
  const router = useRouter()
  const { id } = useParams()
  const [token, setToken] = useState('')
  const [name, setName] = useState('them')
  const [status, setStatus] = useState<Status[]>([])
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState<number | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [reveal, setReveal] = useState(0)
  const [error, setError] = useState('')

  const headers = (t = token) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` })
  const refresh = async (t = token) => {
    const r = await fetch(`/api/round?matchId=${id}`, { headers: headers(t) })
    if (r.ok) setStatus((await r.json()).rounds)
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
      setLoading(false)
      timer = setInterval(() => refresh(session.access_token), 4000)
    })()
    return () => clearInterval(timer)
  }, [])

  const start = (level: number) => { setPlaying(level); setStep(0); setAnswers([]); setError('') }

  const pick = async (idx: number) => {
    const round = ROUNDS.find(r => r.level === playing)!
    const next = [...answers, idx]
    if (next.length < round.qs.length) { setAnswers(next); setStep(step + 1); return }
    const r = await fetch('/api/round', { method: 'POST', headers: headers(), body: JSON.stringify({ matchId: id, level: playing, answers: next }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setError(d.error || 'Something went wrong.'); return }
    setStatus(d.rounds); setPlaying(null)
    const s = d.rounds.find((x: Status) => x.level === round.level)
    if (s?.both) { setViewing(round.level); setReveal(0) }
  }

  if (loading) return <main className="min-h-dvh bg-ink flex items-center justify-center text-mute">Loading...</main>

  // Playing a round
  if (playing) {
    const round = ROUNDS.find(r => r.level === playing)!
    const q = round.qs[step]
    return (
      <main className="min-h-dvh bg-ink text-white p-6">
        <div className="max-w-md mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={() => setPlaying(null)} className="text-mute hover:text-white">← Leave</button>
            <p className="text-mute text-sm">{round.title} · {step + 1} of {round.qs.length}</p>
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

  // Reveal results
  if (viewing) {
    const round = ROUNDS.find(r => r.level === viewing)!
    const s = status.find(x => x.level === viewing)
    if (s?.both) {
      const same = round.qs.map((_, i) => s.both!.mine[i] === s.both!.theirs[i])
      const score = Math.round((same.filter(Boolean).length / round.qs.length) * 100)
      const done = reveal >= round.qs.length
      const next = status.find(x => x.level === viewing + 1)
      const bothSwap = viewing === 3 && s.both.mine[4] === 0 && s.both.theirs[4] === 0
      return (
        <main className="min-h-dvh bg-ink text-white p-6">
          <div className="max-w-md mx-auto space-y-5">
            <button onClick={() => setViewing(null)} className="text-mute hover:text-white">← Back</button>
            <h1 className="text-3xl font-bold">{round.title} results</h1>
            {round.qs.slice(0, reveal).map((q, i) => (
              <div key={q.q} className="pop rounded-2xl bg-panel border border-line p-4 space-y-1">
                <p className="text-mute text-sm">{q.q}</p>
                <p><span className="text-mute">You:</span> {q.options[s.both!.mine[i]]}</p>
                <p><span className="text-mute">{name}:</span> {q.options[s.both!.theirs[i]]}</p>
                {same[i] && <p className="text-ok font-semibold pt-1">Same pick</p>}
              </div>
            ))}
            {!done && <button onClick={() => setReveal(reveal + 1)} className="w-full btn-flame py-4 rounded-full font-semibold text-lg">{reveal === 0 ? 'Reveal first answer' : 'Next answer'}</button>}
            {done && (
              <div className="space-y-4 pt-2">
                <div className="pop text-center rounded-3xl bg-panel border border-line p-8">
                  <p className="text-mute">Your match score</p>
                  <p className="text-7xl font-extrabold bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg,#ff4d6d,#ff8a5b)' }}>{score}%</p>
                </div>
                {bothSwap && <p className="text-center text-ok font-semibold">You both said you're ready to swap.</p>}
                <button onClick={() => router.push(`/chat/${id}${bothSwap ? '?swap=1' : ''}`)} className="w-full btn-flame py-4 rounded-full font-semibold text-lg">{bothSwap ? 'Swap contacts' : 'Back to chat'}</button>
                {next?.unlocked && !next.iDone && <button onClick={() => { setViewing(null); start(next.level) }} className="w-full border border-line rounded-full py-4 font-semibold">Play the next round</button>}
              </div>
            )}
          </div>
        </main>
      )
    }
  }

  return (
    <main className="min-h-dvh bg-ink text-white p-6">
      <div className="max-w-md mx-auto space-y-4">
        <button onClick={() => router.push(`/chat/${id}`)} className="text-mute hover:text-white">← Back to chat</button>
        <h1 className="text-3xl font-bold">Play with {name}</h1>
        <p className="text-mute">Answer privately. Answers are revealed together when you both finish.</p>
        {ROUNDS.map(r => {
          const s = status.find(x => x.level === r.level)
          const action = !s?.unlocked ? { t: `Finish round ${r.level - 1} together to unlock`, on: undefined as any }
            : s.both ? { t: 'See results', on: () => { setViewing(r.level); setReveal(0) } }
            : s.iDone ? { t: `Waiting for ${name} to finish`, on: undefined as any }
            : { t: s.theyDone ? `${name} finished. Your turn` : 'Start', on: () => start(r.level) }
          return (
            <button key={r.level} disabled={!action.on} onClick={action.on}
              className={`w-full text-left p-5 rounded-2xl border transition ${action.on ? 'bg-panel border-line hover:border-white/30' : 'border-line opacity-60'}`}>
              <p className="text-xl font-semibold">{r.title}</p>
              <p className="text-mute text-sm">{r.blurb}</p>
              <p className={`text-sm mt-2 ${action.on ? 'text-ember font-medium' : 'text-mute'}`}>{action.t}</p>
            </button>
          )
        })}
      </div>
    </main>
  )
}
