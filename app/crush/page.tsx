'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'

type Crush = { id: string; email: string; status: 'sent' | 'matched' }
const LABEL = { sent: 'Sent', matched: "It's a match" }

export default function CrushPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [crushes, setCrushes] = useState<Crush[]>([])
  const [left, setLeft] = useState(3)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [token, setToken] = useState('')
  const [pulse, setPulse] = useState<{ n: number; scope: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const load = async (t: string) => {
    const r = await fetch('/api/crush', { headers: { Authorization: `Bearer ${t}` } })
    if (r.ok) { const d = await r.json(); setCrushes(d.crushes); setLeft(d.left) }
  }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setToken(session.access_token)
      load(session.access_token)
      fetch('/api/pulse', { headers: { Authorization: `Bearer ${session.access_token}` } }).then(r => r.ok ? r.json() : null).then(d => d && setPulse(d)).catch(() => {})
    })()
  }, [])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !email.trim()) return
    setBusy(true); setError(''); setSent(false)
    const r = await fetch('/api/crush', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ email }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setError(d.error || 'Something went wrong.'); return }
    setEmail(''); setSent(true); load(token)
  }

  return (
    <main className="min-h-dvh bg-ink text-white pb-24">
      <div className="max-w-md mx-auto px-4 pt-4 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/swipe" aria-label="Back" className="text-mute hover:text-white text-xl">←</Link>
          <h1 className="text-2xl font-bold">Secret crush</h1>
        </div>
        {pulse && pulse.n > 0 && <p className="text-ok text-sm">{pulse.n} secret crushes sent {pulse.scope === 'school' ? 'at your school' : 'on campuses'} this week</p>}
        <p className="text-mute">Put in their college email. They get a note that someone has a crush on them. They never find out it's you unless they like you back.</p>

        {left > 0 ? (
          <form onSubmit={send} className="space-y-3">
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" inputMode="email" autoCapitalize="none" placeholder="their@school.edu"
              className="w-full bg-panel border border-line rounded-xl p-3 text-white placeholder:text-mute" />
            {error && <p className="text-flame text-sm">{error}</p>}
            {sent && <p className="text-ok text-sm">Sent. Your name stays secret.</p>}
            <button disabled={busy || !email.trim()} className="w-full btn-flame py-3 rounded-full font-semibold">{busy ? 'Sending...' : 'Send secret crush'}</button>
            <p className="text-mute text-xs text-center">{left} of 3 left this week</p>
          </form>
        ) : <p className="text-mute text-center">You've used all 3 this week. Each one comes back 7 days after you send it.</p>}

        <button type="button" onClick={async () => {
          const url = 'https://conexxa.net', text = 'Got a crush on someone at school? Send it secretly on Conexxa.'
          try { if (navigator.share) { await navigator.share({ title: 'Conexxa', text, url }); return } await navigator.clipboard.writeText(`${text} ${url}`); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
        }} className="w-full border border-line hover:border-white/30 py-3 rounded-full font-semibold transition">{copied ? 'Link copied' : 'Tell a friend'}</button>

        {crushes.length > 0 && (
          <div className="space-y-2">
            {crushes.map(c => (
              <div key={c.id} className="rounded-2xl bg-panel border border-line p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate">{c.email}</p>
                  <p className={`text-sm ${c.status === 'matched' ? 'text-ok' : 'text-mute'}`}>{LABEL[c.status]}</p>
                </div>
                {c.status === 'matched' && <Link href="/matches" className="btn-flame px-4 py-2 rounded-full text-sm font-semibold">Open</Link>}
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  )
}
