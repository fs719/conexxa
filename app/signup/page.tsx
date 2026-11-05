'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import WaitlistStatus from '@/components/WaitlistStatus'

type Status = { name: string; count: number; goal: number; live: boolean }

// Joining the list: school email, first name, gender, 18+, then the code. No password and no account yet.
export default function SignUp() {
  const router = useRouter()
  const [step, setStep] = useState<'details' | 'code' | 'done'>('details')
  const [form, setForm] = useState({ email: '', name: '', gender: '', adult: false })
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [school, setSchool] = useState<Status | null>(null)
  const [already, setAlready] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setAlready(user.email || 'your account') }).catch(() => {})
  }, [])

  const post = async (url: string, body: object) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { ok: res.ok, data: await res.json().catch(() => ({})) }
  }

  const sendCode = async () => {
    setLoading(true)
    const { ok, data } = await post('/api/auth/send-code', { email: form.email, purpose: 'waitlist' })
    setLoading(false)
    if (!ok) { setError(data.error || 'Could not send the code.'); return }
    setError(''); setStep('code')
  }

  const submitDetails = () => {
    if (!/^[^\s@]+@[^\s@]+\.[a-z]+$/i.test(form.email.trim())) { setError('Please use your school email.'); return }
    if (!form.name.trim()) { setError('Please enter your first name.'); return }
    if (!form.gender) { setError('Please pick one.'); return }
    if (!form.adult) { setError('You must be 18 or older to join.'); return }
    setError(''); sendCode()
  }

  const verify = async () => {
    setLoading(true)
    const { ok, data } = await post('/api/waitlist/join', { ...form, email: form.email.trim().toLowerCase(), code })
    setLoading(false)
    if (!ok) { setError(data.error || 'Invalid code.'); return }
    if (data.hasAccount) { router.push('/login'); return }
    if (data.finish) { router.push(`/finish?e=${encodeURIComponent(form.email.trim().toLowerCase())}&t=${data.finish}`); return }
    setSchool(data.school); setStep('done')
  }

  if (already) return (
    <main className="min-h-dvh bg-ink text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-5">
        <h1 className="text-3xl font-bold">You're already in</h1>
        <p className="text-mute break-words">You're logged in as {already}. To make a different account, log out first.</p>
        <button onClick={() => router.push('/dashboard')} className="w-full btn-flame py-3 rounded-full font-semibold">Open Conexxa</button>
        <button onClick={async () => { await supabase.auth.signOut(); setAlready('') }} className="w-full border border-line hover:border-white/30 py-3 rounded-full font-semibold transition">Log out</button>
      </div>
    </main>
  )

  if (step === 'done' && school) return (
    <main className="min-h-dvh bg-ink text-white flex justify-center p-4">
      <div className="w-full max-w-md py-10 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">You're on the list</h1>
          <p className="text-mute">We'll email you the moment {school.name} opens. That's when you finish up and go live.</p>
        </div>
        <WaitlistStatus name={school.name} count={school.count} goal={school.goal} />
        <p className="text-xs text-mute text-center">Every email we send has a link to take you off the list.</p>
      </div>
    </main>
  )

  return (
    <main className="min-h-dvh bg-ink text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button onClick={() => { setError(''); if (step === 'code') { setStep('details'); setCode('') } else router.push('/') }} className="text-mute hover:text-white mb-6">← Back</button>

        {step === 'details' && (
          <div className="space-y-5">
            <h1 className="text-3xl font-bold">Get on the list</h1>
            <p className="text-mute">Your school opens when 70 students join. We'll email you the day it does.</p>
            <input type="email" placeholder="your@university.edu" value={form.email} autoCapitalize="none"
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full bg-panel border border-line rounded-xl p-3 text-white" />
            <input type="text" placeholder="First name" value={form.name} maxLength={30}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full bg-panel border border-line rounded-xl p-3 text-white" />
            <div className="grid grid-cols-2 gap-3">
              {['Male', 'Female', 'Non-Binary', 'Prefer Not to Say'].map(g => (
                <button key={g} onClick={() => setForm({ ...form, gender: g })}
                  className={`py-3 rounded-xl border transition ${form.gender === g ? 'btn-flame border-transparent' : 'border-line hover:border-white/40'}`}>{g}</button>
              ))}
            </div>
            <label className="flex items-start gap-3 cursor-pointer text-sm">
              <input type="checkbox" className="w-5 h-5 mt-0.5 accent-rose-500" checked={form.adult} onChange={e => setForm({ ...form, adult: e.target.checked })} />
              <span>I'm 18 or older. I agree to the <Link href="/terms" target="_blank" className="underline">Terms</Link> and <Link href="/privacy" target="_blank" className="underline">Privacy Policy</Link>.</span>
            </label>
            {error && <p className="text-flame">{error}</p>}
            <button disabled={loading} onClick={submitDetails} className="w-full btn-flame py-3 rounded-full font-semibold transition">{loading ? 'Sending...' : 'Send my code'}</button>
            <p className="text-center text-mute text-sm">Already have an account? <Link href="/login" className="text-ember hover:underline">Log in</Link></p>
          </div>
        )}

        {step === 'code' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Enter your code</h1>
            <p className="text-mute">We sent a 6-digit code to {form.email}. Check spam if you don't see it.</p>
            <input type="text" inputMode="numeric" maxLength={6} placeholder="123456" value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-panel border border-line rounded-xl p-3 text-white text-center text-2xl tracking-widest" />
            {error && <p className="text-flame">{error}</p>}
            <button disabled={loading || code.length !== 6} onClick={verify} className="w-full btn-flame py-3 rounded-full font-semibold transition">{loading ? 'Checking...' : 'Join the list'}</button>
            <button onClick={sendCode} className="w-full text-mute hover:text-white transition">Resend code</button>
          </div>
        )}
      </div>
    </main>
  )
}
