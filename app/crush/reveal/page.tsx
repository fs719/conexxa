'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Card = { id: string; name: string; age?: number; photo_url?: string | null }
type Match = { id: string; name: string; photo_url: string | null; crush: string | null }

// Someone has a crush on you. A grid of schoolmates, the sender among them. Tap up to 3. No swiping.
export default function Reveal() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [grid, setGrid] = useState<Card[] | null>(null)
  const [max, setMax] = useState(3)
  const [reason, setReason] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ matches: Match[] } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      setToken(session.access_token)
      const r = await fetch('/api/crush/grid', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d.error || 'Something went wrong.'); return }
      setGrid(d.grid); setMax(d.max || 3); setReason(d.reason || '')
    })()
  }, [])

  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : p.length >= max ? p : [...p, id])

  const submit = async () => {
    setBusy(true); setError('')
    const r = await fetch('/api/crush/grid', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ picks: picked }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setError(d.error || 'Something went wrong.'); return }
    if (d.matches?.length) { try { navigator.vibrate?.([25, 50, 25]) } catch {} }
    setResult({ matches: d.matches || [] })
  }

  if (!grid && !error && !result) return <main className="min-h-dvh bg-ink flex items-center justify-center text-mute">Loading...</main>

  if (result) {
    const m = result.matches[0]
    return (
      <main className="relative overflow-hidden min-h-dvh bg-ink text-white flex items-center justify-center p-6">
        <div className="match-glow pointer-events-none absolute inset-0" style={{ background: m ? 'radial-gradient(circle at 50% 38%, rgba(91,227,166,.24), transparent 62%)' : 'none' }} />
        <div className="relative w-full max-w-sm text-center space-y-7">
          {m ? (
            <>
              <h1 className="pop text-5xl font-extrabold bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg,#5be3a6,#b4f7dc)' }}>They had a crush on you</h1>
              <div className="flex justify-center">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-ink bg-raised flex items-center justify-center text-5xl" style={{ boxShadow: '0 0 0 2px rgba(91,227,166,.7), 0 0 30px rgba(91,227,166,.35)' }}>
                  {m.photo_url ? <img src={m.photo_url} alt="" className="w-full h-full object-cover" /> : m.name[0]?.toUpperCase()}
                </div>
              </div>
              <p className="text-mute">You picked {m.name}, and {m.name} picked you first. Answer one question together to open the chat. You have 48 hours.</p>
              <button onClick={() => router.push(`/icebreaker/${m.id}`)} className="w-full py-4 rounded-full font-semibold text-lg btn-crush">Answer the question</button>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold">All done</h1>
              <p className="text-mute">No match this time. Nobody ever knows who you picked.</p>
            </>
          )}
          <button onClick={() => router.push('/swipe')} className="w-full text-mute hover:text-white py-2">Keep going</button>
        </div>
      </main>
    )
  }

  if (!grid) return (
    <main className="min-h-dvh bg-ink text-white flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-5">
        <h1 className="text-3xl font-bold">{reason === 'waiting' ? 'Someone has a crush on you' : 'Nothing waiting'}</h1>
        <p className="text-mute">{reason === 'waiting' ? "We'll show you who to pick from as soon as a few more schoolmates have finished joining. Check back soon." : error || 'No secret crushes waiting for you right now.'}</p>
        <button onClick={() => router.push('/swipe')} className="btn-flame px-8 py-3 rounded-full font-semibold">Keep going</button>
      </div>
    </main>
  )

  return (
    <main className="min-h-dvh bg-ink text-white pb-32">
      <div className="max-w-md mx-auto px-4 pt-8 space-y-5">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-crush">Someone has a crush on you</h1>
          <p className="text-mute">They are one of these people. Tap up to {max}. If you tap them, you both find out. If you don't, nobody ever knows.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {grid.map(c => {
            const on = picked.includes(c.id)
            return (
              <button key={c.id} onClick={() => toggle(c.id)} aria-pressed={on}
                className={`relative rounded-2xl overflow-hidden bg-panel border text-left transition ${on ? 'crush-edge' : 'border-line'}`}>
                <div className="aspect-[3/4] bg-raised flex items-center justify-center">
                  {c.photo_url ? <img src={c.photo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-6xl font-display text-mute">{c.name[0]?.toUpperCase()}</span>}
                </div>
                <div className="absolute inset-x-0 bottom-0 p-3 pt-10 bg-gradient-to-t from-black/85 to-transparent">
                  <p className="font-semibold">{c.name}{c.age ? <span className="text-white/70 font-normal"> {c.age}</span> : null}</p>
                </div>
                {on && <span className="absolute top-2 right-2 w-7 h-7 rounded-full btn-crush flex items-center justify-center text-sm">✓</span>}
              </button>
            )
          })}
        </div>
        {error && <p className="text-flame">{error}</p>}
      </div>
      <div className="fixed bottom-0 inset-x-0 border-t border-line bg-ink/95 backdrop-blur p-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="max-w-md mx-auto space-y-2">
          <button disabled={busy} onClick={submit} className="w-full btn-crush py-4 rounded-full text-lg">{busy ? 'Checking...' : picked.length ? `Pick ${picked.length} of ${max}` : 'Pick no one'}</button>
        </div>
      </div>
    </main>
  )
}
