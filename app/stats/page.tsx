'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Stats() {
  const router = useRouter()
  const [d, setD] = useState<any>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const r = await fetch('/api/stats', { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (!r.ok) { setErr('Owner only.'); return }
      setD(await r.json())
    })()
  }, [])

  if (err) return <main className="min-h-dvh bg-ink text-mute flex items-center justify-center">{err}</main>
  if (!d) return <main className="min-h-dvh bg-ink text-mute flex items-center justify-center">Loading...</main>

  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '0%')
  const Tile = ({ k, v, sub }: { k: string; v: string | number; sub?: string }) => (
    <div className="rounded-2xl bg-panel border border-line p-4"><p className="text-mute text-sm">{k}</p><p className="text-3xl font-bold">{v}</p>{sub && <p className="text-mute text-xs mt-1">{sub}</p>}</div>
  )
  const List = ({ title, o }: { title: string; o: Record<string, number> }) => (
    <div className="rounded-2xl bg-panel border border-line p-4"><p className="text-mute text-sm mb-2">{title}</p>
      {Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => <p key={k} className="flex justify-between"><span>{k}</span><span>{v}</span></p>)}
    </div>
  )

  return (
    <main className="min-h-dvh bg-ink text-white pb-10">
      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
        <div className="flex items-center gap-3"><Link href="/swipe" className="text-mute text-xl">←</Link><h1 className="text-2xl font-bold">Numbers</h1></div>
        <div className="grid grid-cols-2 gap-3">
          <Tile k="People" v={d.people} sub={`${pct(d.withPhoto, d.people)} have a photo`} />
          <Tile k="Swipes" v={d.swipes} sub={`${pct(d.likes, d.swipes)} are likes`} />
          <Tile k="Matches" v={d.matches} sub={`${(d.matches / Math.max(d.people, 1)).toFixed(2)} per person`} />
          <Tile k="Chats opened" v={d.unlocked} sub={`${pct(d.unlocked, d.matches)} of matches`} />
          <Tile k="Messages" v={d.messages} />
          <Tile k="Vibe checks done" v={d.rounds} sub={`${pct(d.rounds, d.unlocked)} of chats`} />
          <Tile k="Contact swaps" v={d.swaps} sub={`${pct(d.swaps, d.unlocked)} of chats`} />
          <Tile k="Crushes sent" v={d.crushes} />
        </div>
        <List title="By school" o={d.schools} />
        <List title="Gender" o={d.gender} />
        <List title="Looking for" o={d.intent} />
      </div>
    </main>
  )
}
