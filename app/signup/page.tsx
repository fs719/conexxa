'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ageFrom } from '@/lib/age'

export default function SignUp() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [code, setCode] = useState('')
  const [form, setForm] = useState({
    birthdate: '',
    email: '',
    password: '',
    name: '',
    gender: '',
    interested_in: '',
    intent: '',
    bio: '',
    interests: [] as string[],
    photo: null as any,
    agreed: false,
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setHasSession(true); setForm(prev => ({ ...prev, email: user.email || '' })) }
    })
  }, [])

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const validateAge = () => ageFrom(form.birthdate) >= 18

  const validateEdu = () => form.email.trim().toLowerCase().endsWith('.edu')

  const post = async (url: string, body: object) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { ok: res.ok, data: await res.json().catch(() => ({})) }
  }

  const handleSendCode = async () => {
    setLoading(true)
    const { ok, data } = await post('/api/auth/send-code', { email: form.email, purpose: 'signup' })
    setLoading(false)
    if (!ok) { setError(data.error || 'Could not send code.'); return }
    setError(''); setCodeSent(true)
  }

  const handleVerify = async () => {
    setLoading(true)
    const { ok, data } = await post('/api/auth/verify-code', { email: form.email, purpose: 'signup', code, password: form.password })
    if (!ok) { setError(data.error || 'Invalid code.'); setLoading(false); return }
    const { error } = await supabase.auth.signInWithPassword({ email: form.email.trim().toLowerCase(), password: form.password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setError(''); setStep(3)
  }

  const saveProfile = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Session expired. Please log in again.')
      setLoading(false)
      router.push('/login')
      return
    }
    const age = ageFrom(form.birthdate)

    let photo_url = null
    if (form.photo) {
      const ext = form.photo.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, form.photo, { upsert: true })
      if (!uploadError) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(path)
        photo_url = data.publicUrl
      }
    }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      name: form.name,
      gender: form.gender,
      interested_in: form.interested_in,
      intent: form.intent,
      bio: form.bio,
      edu_email: form.email.trim().toLowerCase(),
      age: age,
      photo_url,
    })

    if (error) {
      setError('Failed to save profile. Please try again.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {step === 1 && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Confirm Your Age</h1>
            <p className="text-gray-400">You must be 18 or older to join Conexxa.</p>
            <input type="date" value={form.birthdate}
              onChange={e => update('birthdate', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
            />
            {error && <p className="text-red-500">{error}</p>}
            <button onClick={() => {
              if (!form.birthdate) { setError('Please enter your birthdate.'); return }
              if (!validateAge()) { setError('Sorry, you must be 18 or older to use Conexxa.'); return }
              setError(''); setStep(hasSession ? 3 : 2)
            }} className="w-full bg-rose-500 hover:bg-rose-600 py-3 rounded-full font-semibold transition">
              Continue
            </button>
          </div>
        )}

        {step === 2 && !codeSent && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Verify Your Contact</h1>
            <p className="text-gray-400">Only .edu emails are accepted. We'll email you a 6-digit code.</p>
            <input type="email" placeholder="your@university.edu" value={form.email}
              onChange={e => update('email', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
            />
            <input type="password" placeholder="Create a password" value={form.password}
              onChange={e => update('password', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
            />
            {error && <p className="text-red-500">{error}</p>}
            <button disabled={loading} onClick={() => {
              if (!validateEdu()) { setError('Please use a .edu email address.'); return }
              if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
              setError(''); handleSendCode()
            }} className="w-full bg-rose-500 hover:bg-rose-600 py-3 rounded-full font-semibold transition">
              {loading ? 'Sending...' : 'Send Code'}
            </button>
          </div>
        )}

        {step === 2 && codeSent && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Enter Your Code</h1>
            <p className="text-gray-400">We sent a 6-digit code to {form.email}. Check spam if you don't see it.</p>
            <input type="text" inputMode="numeric" maxLength={6} placeholder="123456" value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white text-center text-2xl tracking-widest"
            />
            {error && <p className="text-red-500">{error}</p>}
            <button disabled={loading || code.length !== 6} onClick={handleVerify}
              className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 py-3 rounded-full font-semibold transition">
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button onClick={handleSendCode} className="w-full text-gray-500 hover:text-white transition">Resend code</button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Basic Details</h1>
            <input type="text" placeholder="What should we call you?" value={form.name}
              onChange={e => update('name', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
            />
            <div className="grid grid-cols-2 gap-3">
              {['Male', 'Female', 'Non-Binary', 'Prefer Not to Say'].map(g => (
                <button key={g} onClick={() => update('gender', g)}
                  className={`py-3 rounded-xl border transition ${form.gender === g ? 'bg-rose-500 border-rose-500' : 'border-gray-700 hover:border-rose-500'}`}>
                  {g}
                </button>
              ))}
            </div>
            <p className="text-gray-400 text-sm">Show me</p>
            <div className="grid grid-cols-3 gap-3">
              {[['Male', 'Men'], ['Female', 'Women'], ['everyone', 'Everyone']].map(([v, l]) => (
                <button key={v} onClick={() => update('interested_in', v)}
                  className={`py-3 rounded-xl border transition ${form.interested_in === v ? 'bg-rose-500 border-rose-500' : 'border-gray-700 hover:border-rose-500'}`}>
                  {l}
                </button>
              ))}
            </div>
            {error && <p className="text-red-500">{error}</p>}
            <button onClick={() => {
              if (!form.name) { setError('Please enter your name.'); return }
              if (!form.gender) { setError('Please select your gender.'); return }
              if (!form.interested_in) { setError('Please choose who you want to see.'); return }
              setError(''); setStep(4)
            }} className="w-full bg-rose-500 hover:bg-rose-600 py-3 rounded-full font-semibold transition">
              Continue
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">What brings you here?</h1>
            <div className="space-y-3">
              {[
                { value: 'casual', label: "I'm here for a casual relationship." },
                { value: 'serious', label: "I'm looking for a serious relationship." },
              ].map(opt => (
                <button key={opt.value} onClick={() => update('intent', opt.value)}
                  className={`w-full py-4 rounded-xl border text-left px-4 transition ${form.intent === opt.value ? 'bg-rose-500 border-rose-500' : 'border-gray-700 hover:border-rose-500'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {error && <p className="text-red-500">{error}</p>}
            <button onClick={() => {
              if (!form.intent) { setError('Please select an option.'); return }
              setError(''); setStep(5)
            }} className="w-full bg-rose-500 hover:bg-rose-600 py-3 rounded-full font-semibold transition">
              Continue
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Make Your Profile Shine</h1>
            <p className="text-gray-400">Optional — but it helps!</p>
            <textarea placeholder="Tell us about yourself in one sentence..." value={form.bio}
              onChange={e => update('bio', e.target.value)} maxLength={200}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white h-32 resize-none"
            />
            <div className="space-y-2">
              <p className="text-gray-400 text-sm">Profile photo (optional)</p>
              <input type="file" accept="image/*"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) update('photo', file as any)
                }}
                className="w-full text-gray-400 text-sm"
              />
              {(form as any).photo && (
                <img src={URL.createObjectURL((form as any).photo)} 
                  className="w-24 h-24 rounded-full object-cover" />
              )}
            </div>
            <button onClick={() => setStep(6)}
              className="w-full bg-rose-500 hover:bg-rose-600 py-3 rounded-full font-semibold transition">
              Continue
            </button>
            <button onClick={() => setStep(6)} className="w-full text-gray-500 hover:text-white transition">
              Skip
            </button>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">One Last Step</h1>
            <p className="text-gray-400">Please agree to our Terms of Use and Privacy Policy.</p>
            <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-rose-500"
  onChange={e => update('agreed', e.target.checked as any)}
/>
              <span>I agree to the <Link href="/terms" target="_blank" className="underline">Terms of Use</Link> and <Link href="/privacy" target="_blank" className="underline">Privacy Policy</Link>.</span>
            </label>
            {error && <p className="text-red-500">{error}</p>}
            <button onClick={() => {
  if (!(form as any).agreed) { setError('Please agree to the Terms of Use.'); return }
  saveProfile()
}} className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 py-3 rounded-full font-semibold transition">
  {loading ? 'Saving...' : 'Create Account'}
</button>
          </div>
        )}

      </div>
    </main>
  )
}