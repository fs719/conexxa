'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SignUp() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    birthdate: '',
    email: '',
    password: '',
    name: '',
    gender: '',
    intent: '',
    bio: '',
    interests: [] as string[],
  })

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const validateAge = () => {
    const birth = new Date(form.birthdate)
    const age = new Date().getFullYear() - birth.getFullYear()
    return age >= 18
  }

  const validateEdu = () => form.email.endsWith('.edu')

  const handleSignUp = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })
    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false)
    setStep(3)
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
              setError(''); setStep(2)
            }} className="w-full bg-rose-500 hover:bg-rose-600 py-3 rounded-full font-semibold transition">
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Verify Your Contact</h1>
            <p className="text-gray-400">Only .edu emails are accepted.</p>
            <input type="email" placeholder="your@university.edu" value={form.email}
              onChange={e => update('email', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
            />
            <input type="password" placeholder="Create a password" value={form.password}
              onChange={e => update('password', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
            />
            {error && <p className="text-red-500">{error}</p>}
            <button onClick={() => {
              if (!validateEdu()) { setError('Please use a .edu email address.'); return }
              if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
              setError(''); handleSignUp()
            }} className="w-full bg-rose-500 hover:bg-rose-600 py-3 rounded-full font-semibold transition">
              {loading ? 'Sending...' : 'Send Verification'}
            </button>
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
            {error && <p className="text-red-500">{error}</p>}
            <button onClick={() => {
              if (!form.name) { setError('Please enter your name.'); return }
              if (!form.gender) { setError('Please select your gender.'); return }
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
              <input type="checkbox" className="w-5 h-5 accent-rose-500" />
              <span>I agree to the Terms of Use and Privacy Policy.</span>
            </label>
            <button onClick={() => router.push('/verify')}
              className="w-full bg-rose-500 hover:bg-rose-600 py-3 rounded-full font-semibold transition">
              Create Account
            </button>
          </div>
        )}

      </div>
    </main>
  )
}