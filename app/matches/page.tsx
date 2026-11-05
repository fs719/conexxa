'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { parseTs } from '@/lib/time'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

export default function Matches() {
  const router = useRouter()
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [roles, setRoles] = useState<Record<string, string>>({})
  const [, tick] = useState(0)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        await fetch('/api/swipe', { headers: { Authorization: `Bearer ${session?.access_token}` } })
        const rr = await fetch('/api/crush?matches=1', { headers: { Authorization: `Bearer ${session?.access_token}` } })
        if (rr.ok) setRoles((await rr.json()).roles || {})
      } catch {}

      const { data: matchData } = await supabase.from('matches').select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).order('created_at', { ascending: false })

      const enriched = await Promise.all((matchData || []).map(async (m: any) => {
        const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id
        const { data: p } = await supabase.from('profiles').select('name, photo_url').eq('id', otherId).single()
        return { ...m, other: p }
      }))
      const seen = new Set<string>()
      setMatches(enriched.filter((m: any) => {
        const o = m.user1_id === user.id ? m.user2_id : m.user1_id
        if (seen.has(o)) return false
        seen.add(o); return true
      }))
      setLoading(false)
    }
    init()
    const t = setInterval(() => tick(n => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const expired = (m: any) => !m.chat_unlocked && parseTs(m.expires_at) < new Date()
  const left = (m: any) => {
    const ms = parseTs(m.expires_at).getTime() - Date.now()
    const h = Math.floor(ms / 3600000), mi = Math.floor((ms % 3600000) / 60000)
    return h > 0 ? `${h}h ${mi}m left` : `${mi}m left`
  }
  const myAnswer = (m: any) => (m.user1_id === userId ? m.user1_answer : m.user2_answer)
  const theirAnswer = (m: any) => (m.user1_id === userId ? m.user2_answer : m.user1_answer)

  const live = matches.filter(m => !expired(m))
  const gone = matches.filter(expired)

  const Row = ({ m }: { m: any }) => {
    const unlocked = m.chat_unlocked
    const answered = !!myAnswer(m)
    const go = () => router.push(unlocked ? `/chat/${m.id}` : `/icebreaker/${m.id}`)
    return (
      <button onClick={go} className={`w-full flex items-center gap-4 p-4 rounded-2xl bg-panel border border-line text-left hover:border-white/20 transition ${roles[m.user1_id === userId ? m.user2_id : m.user1_id] ? 'crush-edge' : ''}`}>
        <div className="w-14 h-14 rounded-full overflow-hidden bg-raised flex items-center justify-center text-xl font-bold shrink-0">
          {m.other?.photo_url ? <img src={m.other.photo_url} alt="" className="w-full h-full object-cover" /> : (m.other?.name || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-lg truncate">{m.other?.name || 'Match'}</p>
          {roles[m.user1_id === userId ? m.user2_id : m.user1_id] && (
            <p className="text-xs font-semibold text-crush">{roles[m.user1_id === userId ? m.user2_id : m.user1_id] === 'theirs' ? 'They had a secret crush on you' : 'Your secret crush liked you back'}</p>
          )}
          <p className={`text-sm ${unlocked ? 'text-ok' : answered ? 'text-mute' : 'text-ember'}`}>
            {unlocked ? 'Chat is open' : answered ? `Waiting for them · ${left(m)}` : theirAnswer(m) ? `They answered. Your turn · ${left(m)}` : `Answer one question · ${left(m)}`}
          </p>
        </div>
        <span className="text-mute text-xl">›</span>
      </button>
    )
  }

  return (
    <main className="min-h-dvh bg-ink text-white pb-24">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-3">
        <h1 className="text-3xl font-bold mb-2">Matches</h1>
        {loading && <p className="text-mute">Loading...</p>}
        {!loading && live.length === 0 && (
          <div className="pt-16 text-center space-y-4">
            <p className="text-xl font-semibold">No matches yet</p>
            <p className="text-mute">When you and someone else like each other, they show up here.</p>
            <button onClick={() => router.push('/swipe')} className="btn-flame px-8 py-3 rounded-full font-semibold">Go discover</button>
          </div>
        )}
        {live.map(m => <Row key={m.id} m={m} />)}
        {gone.length > 0 && (
          <>
            <p className="text-sm text-mute pt-4">Expired</p>
            {gone.map(m => (
              <div key={m.id} className="flex items-center gap-4 p-4 rounded-2xl border border-line opacity-50">
                <div className="w-12 h-12 rounded-full bg-raised flex items-center justify-center font-bold">{(m.other?.name || '?')[0].toUpperCase()}</div>
                <p className="font-medium">{m.other?.name || 'Match'}</p>
              </div>
            ))}
          </>
        )}
      </div>
      <BottomNav />
    </main>
  )
}
