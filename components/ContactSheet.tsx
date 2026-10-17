'use client'
import { useEffect, useState } from 'react'

type Contact = { kind: 'phone' | 'instagram' | 'snapchat'; value: string }
const LABEL = { phone: 'Phone number', instagram: 'Instagram', snapchat: 'Snapchat' }

export default function ContactSheet({ matchId, token, name, onClose }: { matchId: string; token: string; name: string; onClose: () => void }) {
  const [mine, setMine] = useState<Contact | null>(null)
  const [theirs, setTheirs] = useState<Contact | null>(null)
  const [kind, setKind] = useState<Contact['kind']>('instagram')
  const [value, setValue] = useState(() => { try { return localStorage.getItem('conexxa_handle') || '' } catch { return '' } })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const apply = (d: any) => { setMine(d.mine); setTheirs(d.theirs) }
  useEffect(() => {
    fetch(`/api/contact?matchId=${matchId}`, { headers: h }).then(r => r.json()).then(apply).catch(() => {})
    const t = setInterval(() => fetch(`/api/contact?matchId=${matchId}`, { headers: h }).then(r => r.json()).then(apply).catch(() => {}), 4000)
    return () => clearInterval(t)
  }, [])

  const submit = async () => {
    setBusy(true); setErr('')
    const r = await fetch('/api/contact', { method: 'POST', headers: h, body: JSON.stringify({ matchId, kind, value }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(d.error || 'Something went wrong.'); return }
    try { localStorage.setItem('conexxa_handle', value.trim().replace(/^@/, '')) } catch {}
    apply(d)
  }
  const withdraw = async () => {
    const r = await fetch('/api/contact', { method: 'DELETE', headers: h, body: JSON.stringify({ matchId }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) apply(d); else setErr(d.error || '')
  }

  const pretty = (c: Contact) => c.kind === 'phone' ? c.value.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3') : `@${c.value}`
  const link = (c: Contact) => c.kind === 'phone' ? `sms:${c.value}` : c.kind === 'instagram' ? `https://instagram.com/${c.value}` : `https://www.snapchat.com/add/${c.value}`

  return (
    <div className="fixed inset-0 z-30 bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-panel border border-line rounded-t-3xl sm:rounded-3xl p-6 space-y-5" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
        {theirs && mine ? (
          <>
            <h2 className="text-2xl font-bold">You both said yes</h2>
            <p className="text-mute">{name} shared this with you:</p>
            <div className="rounded-2xl bg-raised p-4">
              <p className="text-sm text-mute">{LABEL[theirs.kind]}</p>
              <p className="text-2xl font-semibold break-all">{pretty(theirs)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <a href={link(theirs)} target="_blank" rel="noreferrer" className="btn-flame text-center py-3 rounded-full font-semibold">{theirs.kind === 'phone' ? 'Send a text' : 'Open profile'}</a>
              <button onClick={() => { navigator.clipboard?.writeText(theirs.kind === 'phone' ? theirs.value : theirs.value); setCopied(true); setTimeout(() => setCopied(false), 1500) }} className="border border-line rounded-full py-3 font-semibold">{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <p className="text-xs text-mute">Meeting someone new? Pick a public place and tell a friend where you are.</p>
          </>
        ) : mine ? (
          <>
            <h2 className="text-2xl font-bold">You're in</h2>
            <p className="text-mute">{name} sees nothing unless they say yes too. If they do, you both get each other's {LABEL[mine.kind].toLowerCase()} at the same moment.</p>
            <button onClick={withdraw} className="w-full text-mute hover:text-white py-2">Change my mind</button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold">Swap Instagram?</h2>
            <p className="text-mute">{name} only sees yours if they swap too. If they don't, nothing happens and nobody knows.</p>
            <input value={value} onChange={e => setValue(e.target.value)} inputMode={kind === 'phone' ? 'tel' : 'text'} autoCapitalize="none"
              placeholder={kind === 'phone' ? '(555) 123-4567' : '@username'} className="w-full bg-raised border border-line rounded-xl px-4 py-3 text-white placeholder:text-mute" />
            <button onClick={() => { setKind(kind === 'phone' ? 'instagram' : 'phone'); setValue('') }} className="text-sm text-mute hover:text-white">{kind === 'phone' ? 'Use Instagram instead' : 'Use my phone number instead'}</button>
            {err && <p className="text-flame">{err}</p>}
            <button disabled={busy || !value.trim()} onClick={submit} className="w-full btn-flame py-4 rounded-full font-semibold text-lg">{busy ? 'Saving...' : "I'm in"}</button>
          </>
        )}
        <button onClick={onClose} className="w-full text-mute hover:text-white text-sm">Close</button>
      </div>
    </div>
  )
}
