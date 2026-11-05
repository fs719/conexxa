'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PhotoPicker from '@/components/PhotoPicker'
import { supabase } from '@/lib/supabase'

// The one screen at launch: password, optional photo, who to see. Then the person is live.
function Finish() {
  const router = useRouter()
  const q = useSearchParams()
  const email = (q.get('e') || '').toLowerCase()
  const token = q.get('t') || ''
  const [name, setName] = useState('')
  const [state, setState] = useState<'loading' | 'ready' | 'bad' | 'account'>('loading')
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ password: '', birthdate: '', interested_in: '', agreed: false })
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch(`/api/finish?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`).then(async r => {
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg(d.error || 'This link is not valid.'); setState('bad'); return }
      if (d.hasAccount) { setState('account'); return }
      if (!d.live) { setMsg('Your school is not open yet. We will email you the moment it is.'); setState('bad'); return }
      setName(d.name || ''); setState('ready')
    }).catch(() => { setMsg('Something went wrong.'); setState('bad') })
  }, [])

  const go = async () => {
    if (form.password.length < 6) { setMsg('Password must be at least 6 characters.'); return }
    if (!form.birthdate) { setMsg('Please enter your birthdate.'); return }
    if (!form.interested_in) { setMsg('Please choose who you want to see.'); return }
    if (!form.agreed) { setMsg('Please agree to the Terms of Use and Privacy Policy.'); return }
    setBusy(true); setMsg('')
    const r = await fetch('/api/finish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, token, ...form }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setMsg(d.error || 'Something went wrong.'); setBusy(false); return }
    const { data: s, error } = await supabase.auth.signInWithPassword({ email, password: form.password })
    if (error || !s.user) { setMsg('Your account is ready. Please log in.'); setBusy(false); router.push('/login'); return }
    if (photo) {
      const ext = photo.name.split('.').pop()
      const path = `${s.user.id}/avatar.${ext}`
      const { error: ue } = await supabase.storage.from('avatars').upload(path, photo, { upsert: true })
      if (!ue) await supabase.from('profiles').update({ photo_url: `${supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}` }).eq('id', s.user.id)
    }
    router.push('/dashboard?welcome=1')
  }

  if (state === 'loading') return <main className="min-h-dvh bg-ink flex items-center justify-center text-mute">Loading...</main>
  if (state === 'account') return (
    <main className="min-h-dvh bg-ink text-white flex items-center justify-center p-6"><div className="text-center space-y-5">
      <h1 className="text-3xl font-bold">You're already in</h1>
      <Link href="/login" className="inline-block btn-flame px-8 py-3 rounded-full font-semibold">Log in</Link></div></main>
  )
  if (state === 'bad') return (
    <main className="min-h-dvh bg-ink text-white flex items-center justify-center p-6"><div className="text-center space-y-5 max-w-sm">
      <p className="text-mute">{msg}</p><Link href="/" className="inline-block border border-line px-8 py-3 rounded-full font-semibold">Back to Conexxa</Link></div></main>
  )

  return (
    <main className="min-h-dvh bg-ink text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5 py-8">
        <h1 className="text-3xl font-bold">You're in{name ? `, ${name}` : ''}</h1>
        <p className="text-mute">Your school is open. One last screen and you're live.</p>
        <input type="password" placeholder="Choose a password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
          className="w-full bg-panel border border-line rounded-xl p-3 text-white" />
        <div>
          <p className="text-mute text-sm mb-2">Your birthdate (you must be 18+)</p>
          <input type="date" value={form.birthdate} onChange={e => setForm({ ...form, birthdate: e.target.value })} className="w-full bg-panel border border-line rounded-xl p-3 text-white" />
        </div>
        <p className="text-mute text-sm">Show me</p>
        <div className="grid grid-cols-3 gap-3">
          {[['Male', 'Men'], ['Female', 'Women'], ['everyone', 'Everyone']].map(([v, l]) => (
            <button key={v} onClick={() => setForm({ ...form, interested_in: v })}
              className={`py-3 rounded-xl border transition ${form.interested_in === v ? 'btn-flame border-transparent' : 'border-line hover:border-white/40'}`}>{l}</button>
          ))}
        </div>
        <p className="text-xs text-mute -mt-2">Only used to pick who you see. Nobody else ever sees it.</p>
        <div>
          <p className="text-mute text-sm mb-2">A photo (optional, but it helps)</p>
          <PhotoPicker file={photo} onFile={setPhoto} onRemove={() => setPhoto(null)} />
        </div>
        <label className="flex items-start gap-3 cursor-pointer text-sm">
          <input type="checkbox" className="w-5 h-5 mt-0.5 accent-rose-500" checked={form.agreed} onChange={e => setForm({ ...form, agreed: e.target.checked })} />
          <span>I agree to the <Link href="/terms" target="_blank" className="underline">Terms of Use</Link> and <Link href="/privacy" target="_blank" className="underline">Privacy Policy</Link>. Other students at my school will see my first name, photo and school.</span>
        </label>
        {msg && <p className="text-flame">{msg}</p>}
        <button disabled={busy} onClick={go} className="w-full btn-flame py-4 rounded-full font-semibold text-lg">{busy ? 'Going live...' : 'Go live'}</button>
      </div>
    </main>
  )
}

export default function Page() { return <Suspense fallback={null}><Finish /></Suspense> }
