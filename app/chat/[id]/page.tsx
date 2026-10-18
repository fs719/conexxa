'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { parseTs } from '@/lib/time'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import ContactSheet from '@/components/ContactSheet'
import { ROUNDS } from '@/lib/rounds'

type Msg = { id: string; sender_id: string; content: string; created_at: string; pending?: boolean; failed?: boolean }

export default function Chat() {
  const router = useRouter()
  const { id } = useParams()
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [userId, setUserId] = useState('')
  const [match, setMatch] = useState<any>(null)
  const [other, setOther] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const token = useRef('')
  const bottom = useRef<HTMLDivElement>(null)
  const pendingRef = useRef<Msg[]>([])
  const [sheet, setSheet] = useState(false)
  const [turn, setTurn] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [crush, setCrush] = useState<string | null>(null)
  const [swap, setSwap] = useState<{ mine: any; theirs: any } | null>(null)

  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token.current}` })

  const loadSwap = async () => {
    const r = await fetch(`/api/contact?matchId=${id}`, { headers: headers() })
    if (r.ok) setSwap(await r.json())
  }

  const load = async () => {
    const r = await fetch(`/api/messages?matchId=${id}`, { headers: headers() })
    if (r.status === 404 || r.status === 403) { router.push('/matches'); return }
    if (!r.ok) return
    const { messages: server } = await r.json()
    setMessages([...server, ...pendingRef.current])
  }

  useEffect(() => {
    let timer: any, timer2: any
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      token.current = session.access_token
      const uid = session.user.id
      setUserId(uid)
      const { data: m } = await supabase.from('matches').select('*').eq('id', id).single()
      if (!m || !m.chat_unlocked) { router.push('/matches'); return }
      setMatch(m)
      const otherId = m.user1_id === uid ? m.user2_id : m.user1_id
      const { data: p } = await supabase.from('profiles').select('name, photo_url').eq('id', otherId).single()
      setOther(p)
      fetch('/api/crush?matches=1', { headers: headers() }).then(r => r.ok ? r.json() : null).then(d => setCrush(d?.roles?.[otherId] || null)).catch(() => {})
      await load()
      if (new URLSearchParams(window.location.search).get('swap')) setSheet(true)
      const roundCheck = async () => {
        const r = await fetch(`/api/round?matchId=${id}`, { headers: headers() })
        if (r.ok) {
          const x = (await r.json()).rounds[0]
          setTurn(x.theyDone && !x.iDone)
          setScore(x.both ? x.both.mine.filter((v: number, i: number) => v === x.both.theirs[i]).length : null)
        }
      }
      roundCheck(); timer2 = setInterval(() => { roundCheck(); loadSwap() }, 10000)
      loadSwap()
      setLoading(false)
      timer = setInterval(load, 2500)
    })()
    return () => { clearInterval(timer); clearInterval(timer2) }
  }, [])

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  const send = async () => {
    const content = text.trim()
    if (!content) return
    setText('')
    const temp: Msg = { id: `tmp-${Date.now()}`, sender_id: userId, content, created_at: new Date().toISOString(), pending: true }
    pendingRef.current = [...pendingRef.current, temp]
    setMessages(prev => [...prev, temp])
    const r = await fetch('/api/messages', { method: 'POST', headers: headers(), body: JSON.stringify({ matchId: id, content }) })
    pendingRef.current = pendingRef.current.filter(m => m.id !== temp.id)
    if (r.ok) { await load() }
    else {
      const failed = { ...temp, pending: false, failed: true }
      pendingRef.current = [...pendingRef.current, failed]
      setMessages(prev => prev.map(m => m.id === temp.id ? failed : m))
    }
  }

  const retry = (m: Msg) => { pendingRef.current = pendingRef.current.filter(x => x.id !== m.id); setMessages(prev => prev.filter(x => x.id !== m.id)); setText(m.content) }

  const leave = async () => {
    if (!confirm('End this match? They will not be told, and you will not see each other again.')) return
    const r = await fetch('/api/unmatch', { method: 'POST', headers: headers(), body: JSON.stringify({ matchId: id }) })
    if (r.ok) router.push('/matches')
  }

  if (loading) return <main className="min-h-dvh bg-ink flex items-center justify-center text-mute">Opening chat...</main>

  const mine = (m: Msg) => m.sender_id === userId
  const myAnswer = match.user1_id === userId ? match.user1_answer : match.user2_answer
  const theirAnswer = match.user1_id === userId ? match.user2_answer : match.user1_answer
  const time = (s: string) => parseTs(s).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  return (
    <main className="h-dvh bg-ink text-white flex flex-col max-w-md mx-auto w-full">
      <header className={`flex items-center gap-3 px-4 py-3 border-b ${crush ? 'border-[rgba(91,227,166,.35)]' : 'border-line'}`}>
        <button onClick={() => router.push('/matches')} aria-label="Back" className="text-mute hover:text-white text-xl pr-1">←</button>
        <div className={`w-10 h-10 rounded-full overflow-hidden bg-raised flex items-center justify-center font-bold ${crush ? 'ring-2 ring-[#5be3a6]/70' : ''}`}>
          {other?.photo_url ? <img src={other.photo_url} alt="" className="w-full h-full object-cover" /> : (other?.name || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg truncate leading-tight">{other?.name || 'Match'}</h1>
          {(crush || swap?.theirs) && (
            <p className="text-xs font-semibold leading-tight">
              {crush && <span className="text-crush">{crush === 'theirs' ? 'Had a secret crush on you' : 'Your secret crush'}</span>}
              {crush && swap?.theirs && <span className="text-mute"> · </span>}
              {swap?.theirs && <span className="text-ok">Swapped</span>}
            </p>
          )}
        </div>
        <button onClick={leave} className="text-sm text-mute hover:text-white">Not feeling it</button>
        <Link href={`/report?userId=${match.user1_id === userId ? match.user2_id : match.user1_id}`} className="text-sm text-mute hover:text-white">Report</Link>
      </header>

      <div className="px-4 py-2 border-b border-line flex gap-2">
        {swap?.theirs ? (
          <button onClick={() => setSheet(true)} className="w-full py-2.5 rounded-full btn-flame text-sm font-semibold">Swapped. View their {swap.theirs.kind === 'phone' ? 'number' : swap.theirs.kind === 'snapchat' ? 'Snapchat' : 'Instagram'}</button>
        ) : score === null ? (
          <>
            <Link href={`/rounds/${id}`} className="relative flex-1 block text-center py-2.5 rounded-full btn-flame text-sm font-semibold">
              {turn ? `${other?.name || 'They'} did the vibe check. Your turn` : 'Vibe check: 3 quick picks'}
            </Link>
            <button onClick={() => setSheet(true)} className={`px-4 py-2.5 rounded-full border text-sm font-semibold ${swap?.mine ? 'border-white/30 text-mute' : 'border-line hover:border-white/30'}`}>{swap?.mine ? "You're in" : 'Swap'}</button>
          </>
        ) : (
          <button onClick={() => setSheet(true)} className="w-full py-2.5 rounded-full btn-flame text-sm font-semibold">{score} of {ROUNDS[0].qs.length} matched. {swap?.mine ? "You're in, waiting for them" : 'Swap Instagram'}</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {myAnswer && theirAnswer && (
          <div className="rounded-2xl bg-panel border border-line p-4 mb-4 text-sm">
            <p className="text-mute mb-2">{match.icebreaker_prompt}</p>
            <p><span className="text-mute">You:</span> {myAnswer}</p>
            <p><span className="text-mute">{other?.name}:</span> {theirAnswer}</p>
          </div>
        )}
        {messages.length === 0 && <p className="text-center text-mute pt-10">Say hi to {other?.name}. Your answers are a good place to start.</p>}
        {messages.map(m => (
          <div key={m.id} className={`flex ${mine(m) ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[78%]">
              <div className={`px-4 py-2.5 rounded-2xl leading-snug break-words ${mine(m) ? 'btn-flame rounded-br-md' : 'bg-panel border border-line rounded-bl-md'} ${m.pending ? 'opacity-60' : ''}`}>{m.content}</div>
              <p className={`text-[11px] mt-1 px-1 text-mute ${mine(m) ? 'text-right' : ''}`}>
                {m.failed ? <button onClick={() => retry(m)} className="text-flame">Not sent. Tap to edit and resend</button> : m.pending ? 'Sending...' : time(m.created_at)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      {sheet && <ContactSheet matchId={String(id)} token={token.current} name={other?.name || 'them'} onClose={() => { setSheet(false); loadSwap() }} />}

      <form onSubmit={e => { e.preventDefault(); send() }} className="flex gap-2 px-4 py-3 border-t border-line" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Message" maxLength={1000} autoComplete="off"
          className="flex-1 bg-panel border border-line rounded-full px-4 py-3 text-white placeholder:text-mute" />
        <button type="submit" disabled={!text.trim()} className="btn-flame px-6 rounded-full font-semibold">Send</button>
      </form>
    </main>
  )
}
